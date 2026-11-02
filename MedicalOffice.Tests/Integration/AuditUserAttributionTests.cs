
using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MedicalOffice.Tests.Integration;

public class AuditUserAttributionTests
{
    [Fact]
    public async Task AuthenticatedPatientCreation_ShouldRecordUserId()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        await InitializeDatabaseAsync(factory);

        var response = await client.PostAsJsonAsync(
            "/api/patients",
            new
            {
                FirstName = "Audit",
                LastName = "Test"
            });

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var auditLog = await context.AuditLogs
            .AsNoTracking()
            .SingleAsync(a =>
                a.EntityType == "Patient" &&
                a.Action == "Created");

        auditLog.UserId.Should().Be("test-user-id");
        auditLog.EntityId.Should().NotBe(Guid.Empty);
        auditLog.ChangesJson.Should().BeNull();
    }

    [Fact]
    public async Task ClientSuppliedUserId_ShouldNotOverrideAuthenticatedIdentity()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        await InitializeDatabaseAsync(factory);

        var response = await client.PostAsJsonAsync(
            "/api/patients",
            new
            {
                FirstName = "Audit",
                LastName = "SpoofingTest",
                UserId = "malicious-user-id"
            });

        response.StatusCode.Should().Be(HttpStatusCode.Created);

        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var auditLog = await context.AuditLogs
            .AsNoTracking()
            .SingleAsync(a =>
                a.EntityType == "Patient" &&
                a.Action == "Created");

        auditLog.UserId.Should().Be("test-user-id");
        auditLog.UserId.Should().NotBe("malicious-user-id");
    }

    private static async Task InitializeDatabaseAsync(
        CustomWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();
    }
}
