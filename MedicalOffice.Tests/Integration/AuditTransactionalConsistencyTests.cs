
using FluentAssertions;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MedicalOffice.Tests.Integration;

public class AuditTransactionalConsistencyTests
{
    [Fact]
    public async Task ConcurrencyConflict_ShouldNotPersistAuditEvent()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        using var setupScope = factory.Services.CreateScope();

        var setupContext = setupScope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await setupContext.Database.EnsureCreatedAsync();

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            FirstName = "Test",
            LastName = "Patient"
        };

        var doctor = new Doctor
        {
            Id = Guid.NewGuid(),
            FirstName = "Test",
            LastName = "Doctor",
            Specialty = "Cardiology"
        };

        setupContext.Patients.Add(patient);
        setupContext.Doctors.Add(doctor);
        await setupContext.SaveChangesAsync();

        var appointment = new Appointment
        {
            Id = Guid.NewGuid(),
            PatientId = patient.Id,
            DoctorId = doctor.Id,
            StartTime = new DateTime(
                2026, 11, 10, 10, 0, 0),
            EndTime = new DateTime(
                2026, 11, 10, 10, 30, 0)
        };

        setupContext.Appointments.Add(appointment);
        await setupContext.SaveChangesAsync();
        setupContext.ChangeTracker.Clear();

        // Load the same appointment into two DbContexts.
        using var scope1 = factory.Services.CreateScope();
        using var scope2 = factory.Services.CreateScope();

        var context1 = scope1.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var context2 = scope2.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var appointment1 = await context1.Appointments
            .SingleAsync(a => a.Id == appointment.Id);

        var appointment2 = await context2.Appointments
            .SingleAsync(a => a.Id == appointment.Id);

        // First update succeeds.
        appointment1.StartTime = appointment1.StartTime.AddHours(1);
        appointment1.EndTime = appointment1.EndTime.AddHours(1);

        await context1.SaveChangesAsync();

        // Second update uses a stale RowVersion.
        appointment2.StartTime = appointment2.StartTime.AddHours(2);
        appointment2.EndTime = appointment2.EndTime.AddHours(2);

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(
            () => context2.SaveChangesAsync());

        // Check persisted audit history using a fresh context.
        using var verificationScope = factory.Services.CreateScope();

        var verificationContext = verificationScope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var auditLogs = await verificationContext.AuditLogs
            .AsNoTracking()
            .Where(a =>
                a.EntityType == "Appointment" &&
                a.EntityId == appointment.Id)
            .ToListAsync();

        // One creation, one successful update.
        // The failed update must not appear.
        auditLogs.Should().HaveCount(2);

        auditLogs.Should().ContainSingle(
            a => a.Action == "Created");

        auditLogs.Should().ContainSingle(
            a => a.Action == "Updated");
    }


    [Fact]
    public async Task AuditEvent_ShouldRemainTransactionalUntilCommit()
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
            FirstName = "Transaction",
            LastName = "Test"
        };

        await using (var transaction =
            await context.Database.BeginTransactionAsync())
        {
            context.Patients.Add(patient);

            await context.SaveChangesAsync();

            // Audit and business rows are visible
            // inside the active transaction.
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

            await transaction.RollbackAsync();
        }

        context.ChangeTracker.Clear();

        // Both rows must disappear after rollback.
        var persistedPatient = await context.Patients
            .AsNoTracking()
            .AnyAsync(p => p.Id == patient.Id);

        var persistedAudit = await context.AuditLogs
            .AsNoTracking()
            .AnyAsync(a =>
                a.EntityType == "Patient" &&
                a.EntityId == patient.Id);

        persistedPatient.Should().BeFalse();
        persistedAudit.Should().BeFalse();
    }

}
