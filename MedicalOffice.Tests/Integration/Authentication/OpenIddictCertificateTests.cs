using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace MedicalOffice.Tests.Integration.Authentication
{
    public class OpenIddictCertificateTests
    {
        [Fact] 
        public void Production_WithoutCertificates_FailsToStart()
        {
            // Arrange
            using var factory = new WebApplicationFactory<Program>()
                .WithWebHostBuilder(builder =>
                {
                    builder.UseEnvironment("Production");

                    builder.ConfigureAppConfiguration((context, config) =>
                    {
                        config.AddInMemoryCollection(
                            new Dictionary<string, string?>
                            {
                                ["OpenIddict:Clients:SeedOnStartup"] = "false"
                            });
                    });

                    builder.ConfigureAppConfiguration((context, config) =>
                    {
                        config.AddInMemoryCollection(
                            new Dictionary<string, string?>
                            {
                                ["OpenIddict:Certificates:Signing:Path"] = "",
                                ["OpenIddict:Certificates:Signing:Password"] = "",
                                ["OpenIddict:Certificates:Encryption:Path"] = "",
                                ["OpenIddict:Certificates:Encryption:Password"] = ""
                            });
                    });
                });

            // Act
            var exception = Record.Exception(() =>
            {
                using var client = factory.CreateClient();
            });

            // Assert
            Assert.NotNull(exception);

            Assert.Contains(
                "OpenIddict Signing certificate configuration is missing",
                exception.ToString());
        }

        [Fact]
        public void Development_WithDevelopmentCertificates_StartsSuccessfully()
        {
            // Arrange
            using var factory = new WebApplicationFactory<Program>()
                .WithWebHostBuilder(builder =>
                {
                    builder.UseEnvironment("Development");
                });

            // Act
            using var client = factory.CreateClient(
                new WebApplicationFactoryClientOptions
                {
                    BaseAddress = new Uri("https://localhost")
                });

            // Assert
            Assert.NotNull(client);
        }
    }
}
