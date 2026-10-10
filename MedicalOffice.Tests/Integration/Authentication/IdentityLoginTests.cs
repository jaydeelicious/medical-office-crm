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
    }
}
