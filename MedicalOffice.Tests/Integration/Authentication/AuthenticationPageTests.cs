
using System.Net;
using System.Net.Http;
using System.Text.RegularExpressions;
using MedicalOffice.Tests.Integration;
using Microsoft.AspNetCore.Mvc.Testing;

namespace MedicalOffice.Tests.Integration.Authentication;

public class AuthenticationPageTests
{
    private static HttpClient CreateClient(
        CustomWebApplicationFactory factory)
    {
        return factory.CreateClient(
            new WebApplicationFactoryClientOptions
            {
                BaseAddress = new Uri("https://localhost"),
                AllowAutoRedirect = false,
                HandleCookies = true
            });
    }

    [Fact]
    public async Task LoginPage_RendersAuthenticationLayout()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        using var response = await client.GetAsync("/account/login");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var html = await response.Content.ReadAsStringAsync();

        Assert.Contains("MedicalOffice", html);
        Assert.Contains("Welcome back", html);
        Assert.Contains("auth-card", html);
        Assert.Contains("/css/auth.css", html);
    }

    [Fact]
    public async Task LoginPage_ContainsRequiredFormFields()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        using var response = await client.GetAsync("/account/login");

        response.EnsureSuccessStatusCode();

        var html = await response.Content.ReadAsStringAsync();

        Assert.Contains("action=\"/account/login\"", html);
        Assert.Contains("method=\"post\"", html);

        Assert.Matches(
            """<input\b[^>]*name="UserName"[^>]*>""",
            html);

        Assert.Matches(
            """<input\b[^>]*name="Password"[^>]*>""",
            html);

        Assert.Contains(
            "autocomplete=\"username\"",
            html);

        Assert.Contains(
            "autocomplete=\"current-password\"",
            html);

        Assert.Contains("__RequestVerificationToken", html);
    }

    [Fact]
    public async Task LoginPage_PreservesOidcReturnUrl()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        const string returnUrl =
            "/connect/authorize?client_id=medicaloffice-angular" +
            "&response_type=code&state=test-state";

        var url = "/account/login?returnUrl=" +
            Uri.EscapeDataString(returnUrl);

        using var response = await client.GetAsync(url);

        response.EnsureSuccessStatusCode();

        var html = await response.Content.ReadAsStringAsync();

        var input = Regex.Match(
            html,
            """<input\b(?=[^>]*name="ReturnUrl")(?=[^>]*value="([^"]*)")[^>]*>""");

        Assert.True(
            input.Success,
            "ReturnUrl hidden input not found.");

        var actualReturnUrl = WebUtility.HtmlDecode(
            input.Groups[1].Value);

        Assert.Equal(returnUrl, actualReturnUrl);
    }

    [Fact]
    public async Task AuthenticationStylesheet_IsAccessible()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = CreateClient(factory);

        using var response = await client.GetAsync("/css/auth.css");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        Assert.Equal(
            "text/css",
            response.Content.Headers.ContentType?.MediaType);

        var css = await response.Content.ReadAsStringAsync();

        Assert.Contains(".auth-page", css);
        Assert.Contains(".auth-card", css);
        Assert.Contains(".form-input", css);
        Assert.Contains(".auth-button", css);
    }
}
