
using FluentAssertions;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MedicalOffice.Tests.Integration;

public class AuditEventCaptureTests
{
    [Fact]
    public async Task CreatingPatient_ShouldGenerateCreatedAuditLog()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var patient = CreatePatient();

        context.Patients.Add(patient);
        await context.SaveChangesAsync();

        var auditLog = await context.AuditLogs
            .AsNoTracking()
            .SingleAsync();

        auditLog.EntityType.Should().Be("Patient");
        auditLog.EntityId.Should().Be(patient.Id);
        auditLog.Action.Should().Be("Created");
        auditLog.OccurredAtUtc.Should()
            .BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(30));
        auditLog.UserId.Should().BeNull();
    }

    [Fact]
    public async Task UpdatingDoctor_ShouldGenerateUpdatedAuditLog()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var doctor = new Doctor
        {
            Id = Guid.NewGuid(),
            FirstName = "John",
            LastName = "Smith",
            Specialty = "Cardiology"
        };

        context.Doctors.Add(doctor);
        await context.SaveChangesAsync();

        context.ChangeTracker.Clear();

        var savedDoctor = await context.Doctors
            .SingleAsync(d => d.Id == doctor.Id);

        savedDoctor.Specialty = "Neurology";

        await context.SaveChangesAsync();

        var auditLogs = await context.AuditLogs
            .AsNoTracking()
            .Where(a => a.EntityId == doctor.Id)
            .ToListAsync();

        auditLogs.Should().HaveCount(2);
        auditLogs.Should().ContainSingle(
            a => a.Action == "Created");
        auditLogs.Should().ContainSingle(
            a => a.Action == "Updated");
    }

    [Fact]
    public async Task DeletingPatient_ShouldGenerateDeletedAuditLog()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var patient = CreatePatient();

        context.Patients.Add(patient);
        await context.SaveChangesAsync();

        context.ChangeTracker.Clear();

        var savedPatient = await context.Patients
            .SingleAsync(p => p.Id == patient.Id);

        context.Patients.Remove(savedPatient);
        await context.SaveChangesAsync();

        var auditLogs = await context.AuditLogs
            .AsNoTracking()
            .Where(a => a.EntityId == patient.Id)
            .ToListAsync();

        auditLogs.Should().ContainSingle(
            a => a.Action == "Deleted");

        (await context.Patients.AnyAsync(p => p.Id == patient.Id))
            .Should().BeFalse();
    }

    [Fact]
    public async Task UnchangedEntity_ShouldNotGenerateAuditLog()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var patient = CreatePatient();

        context.Patients.Add(patient);
        await context.SaveChangesAsync();

        context.ChangeTracker.Clear();

        _ = await context.Patients
            .SingleAsync(p => p.Id == patient.Id);

        await context.SaveChangesAsync();

        var auditLogs = await context.AuditLogs
            .AsNoTracking()
            .ToListAsync();

        auditLogs.Should().ContainSingle();
        auditLogs[0].Action.Should().Be("Created");
    }

    [Fact]
    public async Task MultipleEntityChanges_ShouldGenerateSeparateAuditLogs()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var patient = CreatePatient();

        var doctor = new Doctor
        {
            Id = Guid.NewGuid(),
            FirstName = "Jane",
            LastName = "Smith",
            Specialty = "Dermatology"
        };

        context.Patients.Add(patient);
        context.Doctors.Add(doctor);

        await context.SaveChangesAsync();

        var auditLogs = await context.AuditLogs
            .AsNoTracking()
            .ToListAsync();

        auditLogs.Should().HaveCount(2);

        auditLogs.Should().ContainSingle(a =>
            a.EntityType == "Patient" &&
            a.EntityId == patient.Id &&
            a.Action == "Created");

        auditLogs.Should().ContainSingle(a =>
            a.EntityType == "Doctor" &&
            a.EntityId == doctor.Id &&
            a.Action == "Created");
    }

    [Fact]
    public async Task AuditLog_ShouldNotContainSensitivePatientData()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            FirstName = "SensitiveFirstName",
            LastName = "SensitiveLastName",
            Email = "private@example.com",
            Phone = "9999999999"
        };

        context.Patients.Add(patient);
        await context.SaveChangesAsync();

        var auditLog = await context.AuditLogs
            .AsNoTracking()
            .SingleAsync();

        auditLog.ChangesJson.Should().BeNull();
        auditLog.EntityType.Should().Be("Patient");
        auditLog.EntityId.Should().Be(patient.Id);
        auditLog.Action.Should().Be("Created");
    }


    [Fact]
    public async Task TransactionRollback_ShouldRollbackBusinessAndAuditLogs()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var patient = CreatePatient();

        // Act: Save inside a transaction, then roll it back.
        await using (var transaction =
            await context.Database.BeginTransactionAsync())
        {
            context.Patients.Add(patient);
            await context.SaveChangesAsync();

            (await context.Patients
                .AnyAsync(p => p.Id == patient.Id))
                .Should().BeTrue();

            (await context.AuditLogs
                .AnyAsync(a => a.EntityId == patient.Id))
                .Should().BeTrue();

            await transaction.RollbackAsync();
        }

        // Verify from a fresh DbContext without tracked entities.
        using var verificationScope = factory.Services.CreateScope();

        var verificationContext = verificationScope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var patientExists = await verificationContext.Patients
            .AsNoTracking()
            .AnyAsync(p => p.Id == patient.Id);

        var auditExists = await verificationContext.AuditLogs
            .AsNoTracking()
            .AnyAsync(a => a.EntityId == patient.Id);

        // Assert
        patientExists.Should().BeFalse();
        auditExists.Should().BeFalse();
    }


    [Fact]
    public async Task FailedSaveRetry_ShouldNotGenerateDuplicateAuditLogs()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            FirstName = null!,
            LastName = "RetryTest"
        };

        context.Patients.Add(patient);

        // Act 1: First attempt fails because FirstName is required.
        await Assert.ThrowsAsync<DbUpdateException>(
            () => context.SaveChangesAsync());

        // Fix the entity and retry.
        patient.FirstName = "ValidName";

        // Act 2: Retry using the same DbContext.
        await context.SaveChangesAsync();

        // Assert: Only one audit record should exist.
        var auditLogs = await context.AuditLogs
            .AsNoTracking()
            .Where(a =>
                a.EntityType == "Patient" &&
                a.EntityId == patient.Id)
            .ToListAsync();

        auditLogs.Should().ContainSingle();

        auditLogs[0].Action.Should().Be("Created");

        (await context.Patients
            .AsNoTracking()
            .AnyAsync(p => p.Id == patient.Id))
            .Should().BeTrue();
    }


    [Fact]
    public async Task SeparateSuccessfulUpdates_ShouldGenerateSeparateAuditLogs()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var patient = CreatePatient();

        context.Patients.Add(patient);
        await context.SaveChangesAsync();

        patient.FirstName = "FirstUpdate";
        await context.SaveChangesAsync();

        patient.FirstName = "SecondUpdate";
        await context.SaveChangesAsync();

        var auditLogs = await context.AuditLogs
            .AsNoTracking()
            .Where(a =>
                a.EntityType == "Patient" &&
                a.EntityId == patient.Id)
            .ToListAsync();

        auditLogs.Should().HaveCount(3);

        auditLogs.Count(a => a.Action == "Created")
            .Should().Be(1);

        auditLogs.Count(a => a.Action == "Updated")
            .Should().Be(2);
    }


    [Fact]
    public async Task SaveWithoutAcceptingChanges_ShouldNotGenerateDuplicateAuditLogs()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var patient = CreatePatient();

        context.Patients.Add(patient);

        await context.SaveChangesAsync(
            acceptAllChangesOnSuccess: false);

        // EF Core still tracks the patient as Added.
        context.Entry(patient).State.Should()
            .Be(EntityState.Added);

        // Accept the successful save and verify the audit history.
        context.ChangeTracker.AcceptAllChanges();

        var auditLogs = await context.AuditLogs
            .AsNoTracking()
            .Where(a => a.EntityId == patient.Id)
            .ToListAsync();

        auditLogs.Should().ContainSingle();
    }


    [Fact]
    public async Task AbandonedCreation_ShouldNotPersistOrphanAuditLog()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            FirstName = null!,
            LastName = "Abandoned"
        };

        context.Patients.Add(patient);

        await Assert.ThrowsAsync<DbUpdateException>(
            () => context.SaveChangesAsync());

        // Abandon the creation.
        context.Entry(patient).State = EntityState.Detached;

        // A subsequent save must not persist an orphan audit record.
        await context.SaveChangesAsync();

        var auditLogs = await context.AuditLogs
            .AsNoTracking()
            .Where(a =>
                a.EntityType == "Patient" &&
                a.EntityId == patient.Id)
            .ToListAsync();

        auditLogs.Should().BeEmpty();
    }


    [Fact]
    public async Task AbandonedUpdate_ShouldNotPersistAuditLog()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        // Arrange: Create and persist the original patient.
        var patient = CreatePatient();

        context.Patients.Add(patient);
        await context.SaveChangesAsync();

        context.ChangeTracker.Clear();

        // Load and modify the patient.
        var savedPatient = await context.Patients
            .SingleAsync(p => p.Id == patient.Id);

        savedPatient.FirstName = null!;

        // Force an invalid update.
        await Assert.ThrowsAsync<DbUpdateException>(
            () => context.SaveChangesAsync());

        // Abandon the update by restoring the original database values.
        await context.Entry(savedPatient)
            .ReloadAsync();

        // Trigger another save.
        await context.SaveChangesAsync();

        // Assert: Only the original Created event should exist.
        var auditLogs = await context.AuditLogs
            .AsNoTracking()
            .Where(a =>
                a.EntityType == "Patient" &&
                a.EntityId == patient.Id)
            .ToListAsync();

        auditLogs.Should().ContainSingle();

        auditLogs[0].Action.Should().Be("Created");

        // Verify the original patient still exists.
        var persistedPatient = await context.Patients
            .AsNoTracking()
            .SingleAsync(p => p.Id == patient.Id);

        persistedPatient.FirstName.Should().Be("Test");
    }


    [Fact]
    public async Task FailedUpdateFollowedByDelete_ShouldAuditOnlyDeletion()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var patient = CreatePatient();

        context.Patients.Add(patient);
        await context.SaveChangesAsync();

        context.ChangeTracker.Clear();

        var savedPatient = await context.Patients
            .SingleAsync(p => p.Id == patient.Id);

        // Attempt an invalid update.
        savedPatient.FirstName = null!;

        await Assert.ThrowsAsync<DbUpdateException>(
            () => context.SaveChangesAsync());

        // Instead of retrying the update, delete the patient.
        context.Patients.Remove(savedPatient);

        await context.SaveChangesAsync();

        var auditLogs = await context.AuditLogs
            .AsNoTracking()
            .Where(a =>
                a.EntityType == "Patient" &&
                a.EntityId == patient.Id)
            .ToListAsync();

        auditLogs.Should().HaveCount(2);

        auditLogs.Should().ContainSingle(
            a => a.Action == "Created");

        auditLogs.Should().ContainSingle(
            a => a.Action == "Deleted");

        auditLogs.Should().NotContain(
            a => a.Action == "Updated");

        (await context.Patients
            .AsNoTracking()
            .AnyAsync(p => p.Id == patient.Id))
            .Should().BeFalse();
    }


    [Fact]
    public async Task SeparateDbContexts_ShouldPersistIndependentAuditLogs()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        using var scope1 = factory.Services.CreateScope();
        using var scope2 = factory.Services.CreateScope();

        var context1 = scope1.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var context2 = scope2.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context1.Database.EnsureCreatedAsync();

        var patient1 = CreatePatient();
        var patient2 = CreatePatient();

        // First context creates its own patient.
        context1.Patients.Add(patient1);
        await context1.SaveChangesAsync();

        // Second context creates another patient.
        context2.Patients.Add(patient2);
        await context2.SaveChangesAsync();

        // Verify both audit events were persisted.
        using var verificationScope = factory.Services.CreateScope();

        var verificationContext = verificationScope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var auditLogs = await verificationContext.AuditLogs
            .AsNoTracking()
            .Where(a =>
                a.EntityType == "Patient" &&
                (a.EntityId == patient1.Id ||
                 a.EntityId == patient2.Id))
            .ToListAsync();

        auditLogs.Should().HaveCount(2);

        auditLogs.Should().ContainSingle(a =>
            a.EntityId == patient1.Id &&
            a.Action == "Created");

        auditLogs.Should().ContainSingle(a =>
            a.EntityId == patient2.Id &&
            a.Action == "Created");
    }


    private static Patient CreatePatient()
    {
        return new Patient
        {
            Id = Guid.NewGuid(),
            FirstName = "Test",
            LastName = "Patient"
        };
    }
}
