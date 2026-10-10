
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
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

public class TokenEndpointTests
{
    private const string ClientId = "medcrm-token-test-client";
    private const string RedirectUri = "https://client.example/callback";

    private const string CodeVerifier =
        "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";

    private const string CodeChallenge =
        "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

    [Fact]
    public async Task Token_WithValidCode_ReturnsTokens()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        await SetupAsync(factory);
        await LoginAsync(client);

        var code = await GetAuthorizationCodeAsync(client);

        using var response = await ExchangeCodeAsync(client, code);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        using var document = await response.Content
            .ReadFromJsonAsync<JsonDocument>();

        Assert.NotNull(document);

        var root = document.RootElement;

        Assert.False(string.IsNullOrWhiteSpace(
            root.GetProperty("access_token").GetString()));

        Assert.Equal(
            "Bearer",
            root.GetProperty("token_type").GetString());

        Assert.True(root.GetProperty("expires_in").GetInt32() > 0);

        Assert.False(string.IsNullOrWhiteSpace(
            root.GetProperty("id_token").GetString()));
    }

    [Fact]
    public async Task Token_WithInvalidPkceVerifier_IsRejected()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        await SetupAsync(factory);
        await LoginAsync(client);

        var code = await GetAuthorizationCodeAsync(client);

        using var response = await ExchangeCodeAsync(
            client,
            code,
            "WrongVerifierWithEnoughCharacters123456789012345");

        Assert.Equal(
            HttpStatusCode.BadRequest,
            response.StatusCode);

        using var document = await response.Content
            .ReadFromJsonAsync<JsonDocument>();

        Assert.NotNull(document);

        Assert.Equal(
            Errors.InvalidGrant,
            document.RootElement.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Token_WithReusedCode_IsRejected()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        await SetupAsync(factory);
        await LoginAsync(client);

        var code = await GetAuthorizationCodeAsync(client);

        using var firstResponse = await ExchangeCodeAsync(client, code);

        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);

        // Authorization codes must only be redeemed once.
        using var secondResponse = await ExchangeCodeAsync(client, code);

        Assert.Equal(
            HttpStatusCode.BadRequest,
            secondResponse.StatusCode);

        using var document = await secondResponse.Content
            .ReadFromJsonAsync<JsonDocument>();

        Assert.NotNull(document);

        Assert.Equal(
            Errors.InvalidGrant,
            document.RootElement.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Token_WithValidRefreshToken_IssuesNewAccessToken()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        await SetupAsync(factory);
        await LoginAsync(client);

        var code = await GetAuthorizationCodeAsync(
            client,
            requestRefreshToken: true);

        using var initialResponse = await ExchangeCodeAsync(client, code);

        Assert.Equal(HttpStatusCode.OK, initialResponse.StatusCode);

        using var initialDocument = await initialResponse.Content
            .ReadFromJsonAsync<JsonDocument>();

        Assert.NotNull(initialDocument);

        var refreshToken = initialDocument.RootElement
            .GetProperty("refresh_token")
            .GetString();

        Assert.False(string.IsNullOrWhiteSpace(refreshToken));

        using var refreshResponse = await RefreshAsync(
            client,
            refreshToken!);

        Assert.Equal(HttpStatusCode.OK, refreshResponse.StatusCode);

        using var refreshedDocument = await refreshResponse.Content
            .ReadFromJsonAsync<JsonDocument>();

        Assert.NotNull(refreshedDocument);

        Assert.False(string.IsNullOrWhiteSpace(
            refreshedDocument.RootElement
                .GetProperty("access_token")
                .GetString()));
    }

    [Fact]
    public async Task Token_WhenUserDeleted_ReturnsInvalidGrant()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        await SetupAsync(factory);
        await LoginAsync(client);

        var code = await GetAuthorizationCodeAsync(client);

        using (var scope = factory.Services.CreateScope())
        {
            var userManager = scope.ServiceProvider
                .GetRequiredService<UserManager<ApplicationUser>>();

            var user = await userManager.FindByNameAsync("testuser");

            Assert.NotNull(user);

            var result = await userManager.DeleteAsync(user);

            Assert.True(result.Succeeded);
        }

        using var response = await ExchangeCodeAsync(client, code);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var document = await response.Content
            .ReadFromJsonAsync<JsonDocument>();

        Assert.NotNull(document);

        Assert.Equal(
            Errors.InvalidGrant,
            document.RootElement.GetProperty("error").GetString());
    }

    [Fact]
    public async Task Token_WhenUserLockedOut_ReturnsInvalidGrant()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        await SetupAsync(factory);
        await LoginAsync(client);

        var code = await GetAuthorizationCodeAsync(client);

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

        using var response = await ExchangeCodeAsync(client, code);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var document = await response.Content
            .ReadFromJsonAsync<JsonDocument>();

        Assert.NotNull(document);

        Assert.Equal(
            Errors.InvalidGrant,
            document.RootElement.GetProperty("error").GetString());
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

    private static async Task SetupAsync(
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
                result.Errors.Select(e => e.Description)));

        var manager = scope.ServiceProvider
            .GetRequiredService<IOpenIddictApplicationManager>();

        await manager.CreateAsync(new OpenIddictApplicationDescriptor
        {
            ClientId = ClientId,
            ClientType = ClientTypes.Public,
            ConsentType = ConsentTypes.Implicit,

            RedirectUris = { new Uri(RedirectUri) },

            Permissions =
            {
                Permissions.Endpoints.Authorization,
                Permissions.Endpoints.Token,
                Permissions.GrantTypes.AuthorizationCode,
                Permissions.GrantTypes.RefreshToken,
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
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["UserName"] = "testuser",
                ["Password"] = "Password123!",
                ["__RequestVerificationToken"] = match.Groups[1].Value
            }));

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
    }

    private static async Task<string> GetAuthorizationCodeAsync(
        HttpClient client,
        bool requestRefreshToken = false)
    {
        var scope = requestRefreshToken
            ? "openid profile email offline_access"
            : "openid profile email";

        var parameters = new Dictionary<string, string>
        {
            ["client_id"] = ClientId,
            ["response_type"] = "code",
            ["redirect_uri"] = RedirectUri,
            ["scope"] = scope,
            ["state"] = "token-test-state",
            ["code_challenge"] = CodeChallenge,
            ["code_challenge_method"] = "S256"
        };

        var query = string.Join("&", parameters.Select(
            p => $"{Uri.EscapeDataString(p.Key)}=" +
                 $"{Uri.EscapeDataString(p.Value)}"));

        using var response = await client.GetAsync(
            "/connect/authorize?" + query);

        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);

        var location = response.Headers.Location;
        Assert.NotNull(location);

        var callback = new Uri(client.BaseAddress!, location);

        Assert.Equal("client.example", callback.Host);

        var values = QueryHelpers.ParseQuery(callback.Query);

        Assert.Equal(
            "token-test-state",
            values["state"].ToString());

        Assert.True(values.TryGetValue("code", out var code));
        Assert.False(string.IsNullOrWhiteSpace(code.ToString()));

        return code.ToString();
    }

    private static Task<HttpResponseMessage> ExchangeCodeAsync(
        HttpClient client,
        string code,
        string verifier = CodeVerifier)
    {
        return client.PostAsync(
            "/connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = GrantTypes.AuthorizationCode,
                ["client_id"] = ClientId,
                ["redirect_uri"] = RedirectUri,
                ["code"] = code,
                ["code_verifier"] = verifier
            }));
    }

    private static Task<HttpResponseMessage> RefreshAsync(
        HttpClient client,
        string refreshToken)
    {
        return client.PostAsync(
            "/connect/token",
            new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = GrantTypes.RefreshToken,
                ["client_id"] = ClientId,
                ["refresh_token"] = refreshToken
            }));
    }
}
