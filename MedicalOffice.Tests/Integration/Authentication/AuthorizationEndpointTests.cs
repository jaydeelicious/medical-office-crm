using System.Net;
using System.Net.Http.Headers;
using System.Text.RegularExpressions;
using MedicalOffice.Infrastructure.Identity;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenIddict.Abstractions;

using static OpenIddict.Abstractions.OpenIddictConstants;

namespace MedicalOffice.Tests.Integration.Authentication;

public class AuthorizationEndpointTests
{
    private const string ClientId = "medcrm-test-client";
    private const string RedirectUri =
        "https://client.example/callback";

    // Valid S256 PKCE challenge (43 base64url characters).
    private const string CodeChallenge =
        "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

    [Fact]
    public async Task Authorize_WithoutIdentityCookie_RedirectsToLogin()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        await RegisterTestClientAsync(factory);

        using var response = await client.GetAsync(
            BuildAuthorizationUrl());

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.NotNull(response.Headers.Location);

        var location = response.Headers.Location;

        Assert.NotNull(location);

        var absoluteLocation = new Uri(
            client.BaseAddress!,
            location);

        Assert.Equal(
            "/account/login",
            absoluteLocation.AbsolutePath);
    }

    [Fact]
    public async Task Authorize_LoginRedirect_PreservesOriginalRequest()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        await RegisterTestClientAsync(factory);

        using var response = await client.GetAsync(
            BuildAuthorizationUrl());

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);

        var location = response.Headers.Location;
        Assert.NotNull(location);

        var absoluteLocation = new Uri(
            client.BaseAddress!,
            location);

        var query = QueryHelpers.ParseQuery(
            absoluteLocation.Query);

        Assert.True(query.TryGetValue("returnUrl", out var returnUrl));

        var originalUrl = new Uri(
            new Uri("https://localhost"),
            returnUrl.ToString());

        Assert.Equal(
            "/connect/authorize",
            originalUrl.AbsolutePath);

        var originalQuery = Microsoft.AspNetCore.WebUtilities
            .QueryHelpers.ParseQuery(originalUrl.Query);

        Assert.Equal(ClientId, originalQuery["client_id"].ToString());
        Assert.Equal("code", originalQuery["response_type"].ToString());
        Assert.Equal("test-state-123", originalQuery["state"].ToString());
        Assert.Equal("S256",
            originalQuery["code_challenge_method"].ToString());
        Assert.Equal(CodeChallenge,
            originalQuery["code_challenge"].ToString());
    }

    private static async Task LoginAsync(HttpClient client)
    {
        using var page = await client.GetAsync("/account/login");
        page.EnsureSuccessStatusCode();

        var html = await page.Content.ReadAsStringAsync();

        var match = Regex.Match(
            html,
            """<input\b(?=[^>]*\bname="__RequestVerificationToken")(?=[^>]*\bvalue="([^"]+)")[^>]*>""");

        Assert.True(match.Success, "Antiforgery token not found.");

        using var response = await client.PostAsync(
            "/account/login",
            new FormUrlEncodedContent(
                new Dictionary<string, string>
                {
                    ["UserName"] = "testuser",
                    ["Password"] = "Password123!",
                    ["__RequestVerificationToken"] =
                        match.Groups[1].Value
                }));

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);

        Assert.Contains(
            response.Headers.TryGetValues("Set-Cookie", out var cookies)
                ? cookies
                : [],
            cookie => cookie.StartsWith(
                "MedicalOffice.Identity=",
                StringComparison.Ordinal));
    }

    [Fact]
    public async Task Authorize_WithAuthenticatedUser_IssuesAuthorizationCode()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        await RegisterTestClientAsync(factory);
        await CreateTestUserAsync(factory);

        await LoginAsync(client);

        using var response = await client.GetAsync(
            BuildAuthorizationUrl());

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);

        var location = response.Headers.Location;
        Assert.NotNull(location);

        Assert.Equal(
            "https",
            location.Scheme);

        Assert.Equal(
            "client.example",
            location.Host);

        Assert.Equal(
            "/callback",
            location.AbsolutePath);

        var parameters = Microsoft.AspNetCore.WebUtilities
            .QueryHelpers.ParseQuery(location.Query);

        Assert.True(parameters.TryGetValue("code", out var code));

        Assert.False(string.IsNullOrWhiteSpace(code.ToString()));

        Assert.Equal(
            "test-state-123",
            parameters["state"].ToString());
    }

    [Fact]
    public async Task Authorize_WithUnknownClient_IsRejected()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        await RegisterTestClientAsync(factory);

        using var response = await client.GetAsync(
            BuildAuthorizationUrl(
                clientId: "unknown-client"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();

        Assert.Contains("error:invalid_request", body);
        Assert.False(
            response.Headers.Location is { } location &&
            new Uri(client.BaseAddress!, location).Host == "client.example");
    }

    [Fact]
    public async Task Authorize_WithoutSession_PromptNone_ReturnsLoginRequired()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        await RegisterTestClientAsync(factory);

        using var response = await client.GetAsync(
            BuildAuthorizationUrl(prompt: "none"));

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);

        var location = response.Headers.Location;
        Assert.NotNull(location);

        Assert.Equal("client.example", location.Host);

        var parameters = Microsoft.AspNetCore.WebUtilities
            .QueryHelpers.ParseQuery(location.Query);

        Assert.Equal(
            Errors.LoginRequired,
            parameters["error"].ToString());
    }

    [Fact]
    public async Task Authorize_WithLockedOutUser_DoesNotIssueCode()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        await RegisterTestClientAsync(factory);
        await CreateTestUserAsync(factory);

        await LoginAsync(client);

        // Lock the user after login, while the cookie still exists.
        using (var scope = factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider
                .GetRequiredService<UserManager<ApplicationUser>>();

            var user = await userManager.FindByNameAsync("testuser");

            Assert.NotNull(user);

            var result = await userManager.SetLockoutEndDateAsync(
                user,
                DateTimeOffset.UtcNow.AddMinutes(15));

            Assert.True(result.Succeeded);
        }

        using var response = await client.GetAsync(
            BuildAuthorizationUrl());

        // The authorization request must not succeed.
        if (response.Headers.Location is { } location)
        {
            var parameters = Microsoft.AspNetCore.WebUtilities
                .QueryHelpers.ParseQuery(location.Query);

            Assert.False(
                parameters.TryGetValue("code", out var code) &&
                !string.IsNullOrEmpty(code.ToString()));
        }

        Assert.NotEqual(HttpStatusCode.OK, response.StatusCode);
    }

    private static HttpClient CreateClient(
        CustomWebApplicationFactory factory)
    {
        return factory.CreateClient(
            new Microsoft.AspNetCore.Mvc.Testing
                .WebApplicationFactoryClientOptions
            {
                BaseAddress = new Uri("https://localhost"),
                AllowAutoRedirect = false,
                HandleCookies = true
            });
    }

    private static async Task RegisterTestClientAsync(
        CustomWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();

        var db = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await db.Database.EnsureCreatedAsync();

        var manager = scope.ServiceProvider
            .GetRequiredService<IOpenIddictApplicationManager>();

        await manager.CreateAsync(new OpenIddictApplicationDescriptor
        {
            ClientId = ClientId,
            ClientType = ClientTypes.Public,
            ConsentType = ConsentTypes.Implicit,

            RedirectUris =
            {
                new Uri(RedirectUri)
            },

            Permissions =
            {
                Permissions.Endpoints.Authorization,
                Permissions.Endpoints.Token,
                Permissions.GrantTypes.AuthorizationCode,
                Permissions.ResponseTypes.Code,
                Permissions.Scopes.Profile,
                Permissions.Scopes.Email
            },

            Requirements =
            {
                Requirements.Features.ProofKeyForCodeExchange
            }
        });
    }

    private static async Task CreateTestUserAsync(
        CustomWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();

        var db = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await db.Database.EnsureCreatedAsync();

        var userManager = scope.ServiceProvider
            .GetRequiredService<UserManager<ApplicationUser>>();

        var result = await userManager.CreateAsync(
            new ApplicationUser
            {
                UserName = "testuser",
                Email = "test@example.com",
                EmailConfirmed = true
            },
            "Password123!");

        Assert.True(
            result.Succeeded,
            string.Join("; ",
                result.Errors.Select(error => error.Description)));
    }

    private static string BuildAuthorizationUrl(
        string? prompt = null,
        string clientId = ClientId)
    {
        var parameters = new Dictionary<string, string>
        {
            ["client_id"] = clientId,
            ["response_type"] = "code",
            ["redirect_uri"] = RedirectUri,
            ["scope"] = "openid profile email",
            ["state"] = "test-state-123",
            ["code_challenge"] = CodeChallenge,
            ["code_challenge_method"] = "S256"
        };

        if (prompt is not null)
        {
            parameters["prompt"] = prompt;
        }

        var query = string.Join("&", parameters.Select(
            parameter =>
                $"{Uri.EscapeDataString(parameter.Key)}=" +
                $"{Uri.EscapeDataString(parameter.Value)}"));

        return "/connect/authorize?" + query;
    }
}