
using MedicalOffice.Infrastructure.Identity;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Text.RegularExpressions;

namespace MedicalOffice.Tests.Integration.Authentication;

public class LogoutEndpointTests
{
    private const string LogoutUrl =
        "/connect/logout?client_id=medicaloffice-angular" +
        "&post_logout_redirect_uri=http%3A%2F%2Flocalhost%3A4200%2F";

    [Fact]
    public async Task Logout_Get_DisplaysConfirmationPage()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = await CreateClientAsync(factory);

        using var response = await client.GetAsync(LogoutUrl);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var html = await response.Content.ReadAsStringAsync();

        Assert.Contains(
            "Are you sure you want to sign out?",
            html);

        Assert.Contains(
            "__RequestVerificationToken",
            html);
    }

    [Fact]
    public async Task Logout_Post_WithoutAntiforgeryToken_Returns400()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = await CreateClientAsync(factory);

        using var response = await client.PostAsync(
            "/connect/logout",
            new FormUrlEncodedContent(
                new Dictionary<string, string>
                {
                    ["client_id"] = "medicaloffice-angular",
                    ["post_logout_redirect_uri"] =
                        "http://localhost:4200/"
                }));

        Assert.Equal(
            HttpStatusCode.BadRequest,
            response.StatusCode);
    }

    [Fact]
    public async Task Logout_Post_ClearsIdentityCookie_AndRedirects()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = await CreateClientAsync(factory);

        await CreateTestUserAsync(factory);

        // Authenticate with ASP.NET Core Identity.
        var loginToken = await GetAntiforgeryTokenAsync(
            client, "/account/login");

        using var loginResponse = await client.PostAsync(
            "/account/login",
            new FormUrlEncodedContent(
                new Dictionary<string, string>
                {
                    ["UserName"] = "logoutuser",
                    ["Password"] = "Password123!",
                    ["__RequestVerificationToken"] = loginToken
                }));

        Assert.Equal(
            HttpStatusCode.Redirect,
            loginResponse.StatusCode);

        // Open the OIDC logout confirmation page.
        var logoutToken = await GetAntiforgeryTokenAsync(
            client, LogoutUrl);

        // Submit the confirmed OIDC logout request.
        using var logoutResponse = await client.PostAsync(
            "/connect/logout",
            new FormUrlEncodedContent(
                new Dictionary<string, string>
                {
                    ["__RequestVerificationToken"] = logoutToken,
                    ["client_id"] = "medicaloffice-angular",
                    ["post_logout_redirect_uri"] =
                        "http://localhost:4200/"
                }));

        Assert.Equal(
            HttpStatusCode.Redirect,
            logoutResponse.StatusCode);

        Assert.Equal(
            "http://localhost:4200/",
            logoutResponse.Headers.Location?.ToString());

        // Identity should instruct the browser to delete its cookie.
        Assert.True(
            logoutResponse.Headers.TryGetValues(
                "Set-Cookie", out var cookies));

        Assert.Contains(
            cookies,
            cookie =>
                cookie.StartsWith(
                    "MedicalOffice.Identity=",
                    StringComparison.Ordinal) &&
                cookie.Contains(
                    "expires=",
                    StringComparison.OrdinalIgnoreCase));
    }


    [Fact]
    public async Task Logout_Get_DoesNotClearIdentityCookie()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = await CreateClientAsync(factory);

        await CreateTestUserAsync(factory);

        var loginToken = await GetAntiforgeryTokenAsync(
            client, "/account/login");

        using var loginResponse = await client.PostAsync(
            "/account/login",
            new FormUrlEncodedContent(
                new Dictionary<string, string>
                {
                    ["UserName"] = "logoutuser",
                    ["Password"] = "Password123!",
                    ["__RequestVerificationToken"] = loginToken
                }));

        Assert.Equal(
            HttpStatusCode.Redirect,
            loginResponse.StatusCode);

        using var logoutPage = await client.GetAsync(LogoutUrl);

        Assert.Equal(HttpStatusCode.OK, logoutPage.StatusCode);

        // Opening the confirmation page must not clear the cookie.
        Assert.False(
            logoutPage.Headers.TryGetValues(
                "Set-Cookie", out var cookies) &&
            cookies.Any(cookie =>
                cookie.StartsWith(
                    "MedicalOffice.Identity=",
                    StringComparison.Ordinal) &&
                cookie.Contains(
                    "expires=",
                    StringComparison.OrdinalIgnoreCase)));
    }


    [Fact]
    public async Task Logout_WithUnregisteredRedirectUri_IsRejected()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = await CreateClientAsync(factory);

        const string invalidLogoutUrl =
            "/connect/logout?client_id=medicaloffice-angular" +
            "&post_logout_redirect_uri=" +
            "https%3A%2F%2Fevil.example%2Fcallback";

        using var response = await client.GetAsync(invalidLogoutUrl);

        Assert.Equal(
            HttpStatusCode.BadRequest,
            response.StatusCode);

        // OpenIddict must not redirect the browser
        // to an unregistered external URI.
        Assert.False(
            response.Headers.Location is { } location &&
            location.Host == "evil.example");
    }

    private static async Task<HttpClient> CreateClientAsync(
        CustomWebApplicationFactory factory)
    {
        var client = factory.CreateClient(
            new WebApplicationFactoryClientOptions
            {
                BaseAddress = new Uri("https://localhost"),
                AllowAutoRedirect = false,
                HandleCookies = true
            });

        using var scope = factory.Services.CreateScope();

        var db = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await db.Database.EnsureCreatedAsync();

        var manager = scope.ServiceProvider
            .GetRequiredService<
                OpenIddict.Abstractions.IOpenIddictApplicationManager>();

        // The test factory disables automatic client seeding.
        var configuration = new Microsoft.Extensions.Configuration
            .ConfigurationBuilder()
            .AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["OpenIddict:Clients:Angular:RedirectUri"] =
                        "http://localhost:4200/auth/callback",
                    ["OpenIddict:Clients:Angular:PostLogoutRedirectUri"] =
                        "http://localhost:4200/"
                })
            .Build();

        var seeder = new MedicalOffice.Api.Authentication
            .OpenIddictClientSeeder(manager, configuration);

        await seeder.SeedAsync();

        return client;
    }

    private static async Task CreateTestUserAsync(
        CustomWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();

        var manager = scope.ServiceProvider
            .GetRequiredService<UserManager<ApplicationUser>>();

        var result = await manager.CreateAsync(
            new ApplicationUser
            {
                UserName = "logoutuser",
                Email = "logoutuser@example.test"
            },
            "Password123!");

        Assert.True(
            result.Succeeded,
            string.Join("; ",
                result.Errors.Select(e => e.Description)));
    }

    private static async Task<string> GetAntiforgeryTokenAsync(
        HttpClient client,
        string url)
    {
        using var response = await client.GetAsync(url);

        response.EnsureSuccessStatusCode();

        var html = await response.Content.ReadAsStringAsync();

        var match = Regex.Match(
            html,
            """<input\b(?=[^>]*\bname="__RequestVerificationToken")(?=[^>]*\bvalue="([^"]+)")[^>]*>""");

        Assert.True(
            match.Success,
            "Antiforgery token not found.");

        return match.Groups[1].Value;
    }
}
