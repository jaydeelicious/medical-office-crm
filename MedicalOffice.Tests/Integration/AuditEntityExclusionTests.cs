
using FluentAssertions;
using MedicalOffice.Infrastructure.Identity;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using OpenIddict.Abstractions;

namespace MedicalOffice.Tests.Integration;

public class AuditEntityExclusionTests
{
    [Fact]
    public async Task IdentityAndOpenIddictChanges_ShouldNotGenerateAuditLogs()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var initialCount = await context.AuditLogs.CountAsync();

        // Persist an Identity user.
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid().ToString(),
            UserName = $"audit-test-{Guid.NewGuid():N}",
            Email = "identity-test@example.com"
        };

        context.Users.Add(user);
        await context.SaveChangesAsync();

        // Persist an OpenIddict application.
        var manager = scope.ServiceProvider
            .GetRequiredService<IOpenIddictApplicationManager>();

        var clientId = $"audit-test-client-{Guid.NewGuid():N}";

        await manager.CreateAsync(
            new OpenIddictApplicationDescriptor
            {
                ClientId = clientId,
                DisplayName = "Audit Exclusion Test",
                ClientType = OpenIddictConstants.ClientTypes.Public
            });

        // Verify no business audit records were generated.
        var finalCount = await context.AuditLogs
            .AsNoTracking()
            .CountAsync();

        finalCount.Should().Be(initialCount);

        // Confirm both entities were actually persisted.
        (await context.Users
            .AsNoTracking()
            .AnyAsync(u => u.Id == user.Id))
            .Should().BeTrue();

        var application = await manager.FindByClientIdAsync(clientId);
        application.Should().NotBeNull();
    }
}
