using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Text.RegularExpressions;
using MedicalOffice.Infrastructure.Identity;
using MedicalOffice.Infrastructure.Persistence;
using MedicalOffice.Tests.Integration;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MedicalOffice.Tests.Integration.Authentication
{
    public class IdentityLoginTests
    {
        [Fact]
        public async Task LoginPage_ReturnsSuccess()
        {
            using var factory = new CustomWebApplicationFactory();
            using var client = CreateClient(factory);

            using var response =
                await client.GetAsync("/account/login");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(
                "text/html",
                response.Content.Headers.ContentType?.MediaType);
        }

        [Fact]
        public async Task Login_WithoutAntiforgeryToken_Returns400()
        {
            using var factory = new CustomWebApplicationFactory();
            using var client = CreateClient(factory);

            using var response = await client.PostAsync(
                "/account/login",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["UserName"] = "testuser",
                    ["Password"] = "Password123!"
                }));

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Login_WithValidCredentials_IssuesIdentityCookie()
        {
            using var factory = new CustomWebApplicationFactory();
            using var client = CreateClient(factory);

            await CreateTestUserAsync(factory);

            // GET the page to obtain the antiforgery cookie and token.
            using var page = await client.GetAsync("/account/login");
            page.EnsureSuccessStatusCode();

            var html = await page.Content.ReadAsStringAsync();

            var match = Regex.Match(
                html,
                "name=\"__RequestVerificationToken\"\\s+type=\"hidden\"\\s+value=\"([^\"]+)\"|"
                + "name=\"__RequestVerificationToken\"[^>]*value=\"([^\"]+)\"");

            Assert.True(match.Success, "Antiforgery token not found.");

            var token = match.Groups[1].Success
                ? match.Groups[1].Value
                : match.Groups[2].Value;

            using var response = await client.PostAsync(
                "/account/login",
                new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["UserName"] = "testuser",
                    ["Password"] = "Password123!",
                    ["__RequestVerificationToken"] = token
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

        private static async Task CreateTestUserAsync(
            CustomWebApplicationFactory factory)
        {
            using var scope = factory.Services.CreateScope();

            var db = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            await db.Database.EnsureCreatedAsync();

            var userManager = scope.ServiceProvider
                .GetRequiredService<UserManager<ApplicationUser>>();

            var user = new ApplicationUser
            {
                UserName = "testuser",
                Email = "test@example.com"
            };

            var result = await userManager.CreateAsync(
                user,
                "Password123!");

            Assert.True(
                result.Succeeded,
                string.Join("; ", result.Errors.Select(e => e.Description)));
        }

        [Fact]
        public async Task Login_WithInvalidPassword_DoesNotAuthenticate()
        {
            using var factory = new CustomWebApplicationFactory();
            using var client = CreateClient(factory);

            await CreateTestUserAsync(factory);

            using var response = await PostLoginAsync(
                client,
                "testuser",
                "WrongPassword123!");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);

            var html = await response.Content.ReadAsStringAsync();

            Assert.Contains("Invalid username or password", html);

            Assert.False(
                response.Headers.TryGetValues(
                    "Set-Cookie", out var cookies) &&
                cookies.Any(c =>
                    c.StartsWith(
                        "MedicalOffice.Identity=",
                        StringComparison.Ordinal)));
        }

        [Fact]
        public async Task Login_AfterFiveFailedAttempts_LocksUser()
        {
            using var factory = new CustomWebApplicationFactory();
            using var client = CreateClient(factory);

            await CreateTestUserAsync(factory);

            for (var attempt = 0; attempt < 5; attempt++)
            {
                using var response = await PostLoginAsync(
                    client,
                    "testuser",
                    "WrongPassword123!");

                Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            }

            using var scope = factory.Services.CreateScope();

            var userManager = scope.ServiceProvider
                .GetRequiredService<UserManager<ApplicationUser>>();

            var user = await userManager.FindByNameAsync("testuser");

            Assert.NotNull(user);
            Assert.True(await userManager.IsLockedOutAsync(user));

            // Even the correct password must now be rejected.
            using var responseAfterLockout = await PostLoginAsync(
                client,
                "testuser",
                "Password123!");

            Assert.Equal(
                HttpStatusCode.OK,
                responseAfterLockout.StatusCode);

            var html = await responseAfterLockout.Content.ReadAsStringAsync();

            Assert.Contains(
                "Unable to sign in. Please try again later.",
                html);
        }

        [Fact]
        public async Task Logout_WithAuthenticatedUser_ClearsSession()
        {
            using var factory = new CustomWebApplicationFactory();
            using var client = CreateClient(factory);

            await CreateTestUserAsync(factory);

            // Sign in.
            using var loginResponse = await PostLoginAsync(
                client,
                "testuser",
                "Password123!");

            Assert.Equal(
                HttpStatusCode.Redirect,
                loginResponse.StatusCode);

            // Obtain an antiforgery token for the logout request.
            var token = await GetAntiforgeryTokenAsync(client);

            // Sign out.
            using var logoutResponse = await client.PostAsync(
                "/account/logout",
                new FormUrlEncodedContent(
                    new Dictionary<string, string>
                    {
                        ["__RequestVerificationToken"] = token
                    }));

            Assert.Equal(
                HttpStatusCode.Redirect,
                logoutResponse.StatusCode);

            // Identity must instruct the browser to remove its cookie.
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

            // The former session must no longer authorize logout.
            token = await GetAntiforgeryTokenAsync(client);

            using var secondLogout = await client.PostAsync(
                "/account/logout",
                new FormUrlEncodedContent(
                    new Dictionary<string, string>
                    {
                        ["__RequestVerificationToken"] = token
                    }));

            Assert.Equal(
                HttpStatusCode.Redirect,
                secondLogout.StatusCode);

            Assert.NotNull(secondLogout.Headers.Location);

            Assert.Equal(
                "/account/login",
                secondLogout.Headers.Location.AbsolutePath);

            Assert.Contains(
                "ReturnUrl=",
                secondLogout.Headers.Location.Query);
        }

        [Fact]
        public async Task Login_WithExternalReturnUrl_DoesNotRedirectExternally()
        {
            using var factory = new CustomWebApplicationFactory();
            using var client = CreateClient(factory);

            await CreateTestUserAsync(factory);

            using var response = await PostLoginAsync(
                client,
                "testuser",
                "Password123!",
                "https://evil.example/phishing");

            Assert.Equal(
                HttpStatusCode.Redirect,
                response.StatusCode);

            Assert.NotNull(response.Headers.Location);

            Assert.False(
                response.Headers.Location.IsAbsoluteUri);

            Assert.Equal(
                "/account/login",
                response.Headers.Location.OriginalString);
        }

        private static async Task<string> GetAntiforgeryTokenAsync(
            HttpClient client,
            string url = "/account/login")
        {
            using var response = await client.GetAsync(url);
            response.EnsureSuccessStatusCode();

            var html = await response.Content.ReadAsStringAsync();

            var match = Regex.Match(
                html,
                """<input\b(?=[^>]*\bname="__RequestVerificationToken")(?=[^>]*\bvalue="([^"]+)")[^>]*>""");

            Assert.True(match.Success, "Antiforgery token not found.");

            return match.Groups[1].Value;
        }

        private static async Task<HttpResponseMessage> PostLoginAsync(
            HttpClient client,
            string username,
            string password,
            string? returnUrl = null)
        {
            var token = await GetAntiforgeryTokenAsync(client);

            var values = new Dictionary<string, string>
            {
                ["UserName"] = username,
                ["Password"] = password,
                ["__RequestVerificationToken"] = token
            };

            if (returnUrl is not null)
            {
                values["ReturnUrl"] = returnUrl;
            }

            return await client.PostAsync(
                "/account/login",
                new FormUrlEncodedContent(values));
        }
    }
}
