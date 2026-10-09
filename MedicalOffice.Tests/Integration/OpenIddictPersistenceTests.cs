using FluentAssertions;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenIddict.Abstractions;
using System.ComponentModel;

namespace MedicalOffice.Tests.Integration
{
    public class OpenIddictPersistenceTests
    {
        [Fact]
        public async Task Application_ShouldBePersistedAndRetrieved()
        {
            // Arrange
            using var factory = new CustomWebApplicationFactory();
            using var client = factory.CreateClient();

            using var scope = factory.Services.CreateScope();

            var dbContext = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            await dbContext.Database.EnsureCreatedAsync();

            var manager = scope.ServiceProvider
                .GetRequiredService<IOpenIddictApplicationManager>();

            var clientId = $"test-client-{Guid.NewGuid():N}";

            // Act: Create an OpenIddict client.
            await manager.CreateAsync(new OpenIddictApplicationDescriptor
            {
                ClientId = clientId,
                DisplayName = "Test Medical Office Client",
                ClientType = OpenIddictConstants.ClientTypes.Public
            });

            // Assert: Retrieve the peristed client.
            var application = await manager.FindByClientIdAsync(clientId);

            application.Should().NotBeNull();

            var displayName = await manager.GetDisplayNameAsync(application!);

            displayName.Should().Be("Test Medical Office Client");

            // Cleanup
            await manager.DeleteAsync(application!);

            var deletedApplication =
                await manager.FindByClientIdAsync(clientId);

            deletedApplication.Should().BeNull();
        }
    }
}
