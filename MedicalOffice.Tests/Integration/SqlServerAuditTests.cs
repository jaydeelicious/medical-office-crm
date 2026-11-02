
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


    [Fact]
    public async Task SqlServer_RolledBackTransaction_ShouldNotPersistAuditLog()
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
                FirstName = "Rollback",
                LastName = "SqlServerTest"
            };

            // Begin an explicit SQL Server transaction.
            await using (var transaction =
                await context.Database.BeginTransactionAsync())
            {
                context.Patients.Add(patient);

                await context.SaveChangesAsync();

                // Both records should exist within the transaction.
                var patientExists = await context.Patients
                    .AsNoTracking()
                    .AnyAsync(p => p.Id == patient.Id);

                var auditExists = await context.AuditLogs
                    .AsNoTracking()
                    .AnyAsync(a =>
                        a.EntityType == "Patient" &&
                        a.EntityId == patient.Id);

                patientExists.Should().BeTrue();
                auditExists.Should().BeTrue();

                // Roll back both changes.
                await transaction.RollbackAsync();
            }

            // Verify using a fresh DbContext.
            using var verificationScope = factory.Services.CreateScope();

            var verificationContext = verificationScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var persistedPatient = await verificationContext.Patients
                .AsNoTracking()
                .AnyAsync(p => p.Id == patient.Id);

            var persistedAudit = await verificationContext.AuditLogs
                .AsNoTracking()
                .AnyAsync(a =>
                    a.EntityType == "Patient" &&
                    a.EntityId == patient.Id);

            persistedPatient.Should().BeFalse();
            persistedAudit.Should().BeFalse();
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

}
