using System.Net;
using System.Net.Http.Headers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace MedicalOffice.Tests.Integration.Authentication
{
    public class OpenIddictValidationTests
    {
        [Fact]
        public async Task PatientsEndpoint_WithoutToken_Returns401()
        {
            // Arrange
            using var factory = CreateFactory();
            using var client = CreateClient(factory);

            // Act 
            using var response = await client.GetAsync("/api/patients");

            // Assert
            Assert.Equal(
                HttpStatusCode.Unauthorized,
                response.StatusCode);
        }

        [Fact]
        public async Task PatientsEndpoint_WithInvalidToken_Returns401()
        {
            // Arrange
            using var factory = CreateFactory();
            using var client = CreateClient(factory);

            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue(
                    "Bearer",
                    "invalid-access-token");

            // Act
            using var response = await client.GetAsync("/api/patients");

            // Assert
            Assert.Equal(
                HttpStatusCode.Unauthorized,
                response.StatusCode);
        }

        private static WebApplicationFactory<Program> CreateFactory()
        {
            return new WebApplicationFactory<Program>()
                .WithWebHostBuilder(builder =>
                {
                    builder.ConfigureAppConfiguration((context, config) =>
                    {
                        config.AddInMemoryCollection(
                            new Dictionary<string, string?>
                            {
                                ["OpenIddict:Clients:SeedOnStartup"] = "false"
                            });
                    });

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
