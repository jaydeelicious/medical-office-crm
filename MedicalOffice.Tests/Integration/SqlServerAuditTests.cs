
using FluentAssertions;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MedicalOffice.Tests.Integration;

public class SqlServerAuditTests
{
    [Fact]
    public async Task SqlServer_ShouldPersistBusinessAndAuditRecords()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            using var scope = factory.Services.CreateScope();

            var context = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var patient = new Patient
            {
                Id = Guid.NewGuid(),
                FirstName = "Audit",
                LastName = "SqlServerTest"
            };

            context.Patients.Add(patient);

            await context.SaveChangesAsync();

            context.ChangeTracker.Clear();

            var persistedPatient = await context.Patients
                .AsNoTracking()
                .SingleAsync(p => p.Id == patient.Id);

            var auditLog = await context.AuditLogs
                .AsNoTracking()
                .SingleAsync(a =>
                    a.EntityType == "Patient" &&
                    a.EntityId == patient.Id);

            persistedPatient.Id.Should().Be(patient.Id);

            auditLog.Action.Should().Be("Created");
            auditLog.UserId.Should().BeNull();
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }
}
