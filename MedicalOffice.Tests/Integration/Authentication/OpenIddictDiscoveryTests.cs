using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace MedicalOffice.Tests.Integration.Authentication
{
    public class OpenIddictDiscoveryTests
    {
        [Fact]
        public async Task DiscoveryEndpoint_ReturnsSuccess()
        {
            // Arrange
            using var factory = CreateFactory();
            using var client = CreateClient(factory);

            // Act 
            using var response = await client.GetAsync(
                "/.well-known/openid-configuration");

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task DiscoveryEndpoint_AdvertisesExpectedEndpoints()
        {
            // Arrange
            using var factory = CreateFactory();
            using var client = CreateClient(factory);

            // Act
            using var document = await client.GetFromJsonAsync<JsonDocument>(
                "/.well-known/openid-configuration");

            // Assert
            Assert.NotNull(document);

            var root = document.RootElement;

            Assert.Equal(
                "https://localhost/connect/authorize",
                root.GetProperty("authorization_endpoint").GetString());

            Assert.Equal(
                "https://localhost/connect/token",
                root.GetProperty("token_endpoint").GetString());
        }

        [Fact]
        public async Task DiscoveryEndpoint_AdvertisesPkceS256()
        {
            // Arrange
            using var factory = CreateFactory();
            using var client = CreateClient(factory);

            // Act
            using var document = await client.GetFromJsonAsync<JsonDocument>(
                "/.well-known/openid-configuration");

            // Assert
            Assert.NotNull(document);

            var methods = document.RootElement
                .GetProperty("code_challenge_methods_supported")
                .EnumerateArray()
                .Select(value => value.GetString());

            Assert.Contains("S256", methods);
        }

        private static WebApplicationFactory<Program> CreateFactory()
        {
            return new WebApplicationFactory<Program>()
                .WithWebHostBuilder(builder =>
                {
                    builder.UseEnvironment("Development");
                });
        }

        private static HttpClient CreateClient(
            WebApplicationFactory<Program> factory)
        {
            return factory.CreateClient(
                new WebApplicationFactoryClientOptions
                {
                    BaseAddress = new Uri("https://localhost"),
                    AllowAutoRedirect = false
                });
        }
    }
}
