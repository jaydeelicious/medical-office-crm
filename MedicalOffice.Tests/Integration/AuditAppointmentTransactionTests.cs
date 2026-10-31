
using FluentAssertions;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Infrastructure.Persistence;
using MedicalOffice.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MedicalOffice.Tests.Integration;

public class AuditAppointmentTransactionTests
{
    [Fact]
    public async Task SuccessfulAppointmentTransaction_ShouldCommitAuditLog()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var repository = scope.ServiceProvider
            .GetRequiredService<MedicalOffice.Application.Abstractions
                .IAppointmentRepository>();

        await context.Database.EnsureCreatedAsync();

        var appointment = await CreateAppointmentAsync(context);

        await repository.ExecuteWithDoctorLockAsync(
            appointment.DoctorId,
            async () =>
            {
                context.Appointments.Add(appointment);
                await repository.SaveChangesAsync();
                return appointment.Id;
            });

        context.ChangeTracker.Clear();

        (await context.Appointments.AsNoTracking()
            .AnyAsync(a => a.Id == appointment.Id))
            .Should().BeTrue();

        var logs = await context.AuditLogs.AsNoTracking()
            .Where(a => a.EntityType == "Appointment"
                && a.EntityId == appointment.Id)
            .ToListAsync();

        logs.Should().ContainSingle();
        logs[0].Action.Should().Be("Created");
    }

    [Fact]
    public async Task FailedAppointmentTransaction_ShouldRollbackAuditLog()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var repository = scope.ServiceProvider
            .GetRequiredService<MedicalOffice.Application.Abstractions
                .IAppointmentRepository>();

        await context.Database.EnsureCreatedAsync();

        var appointment = await CreateAppointmentAsync(context);

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => repository.ExecuteWithDoctorLockAsync(
                appointment.DoctorId,
                async () =>
                {
                    context.Appointments.Add(appointment);
                    await repository.SaveChangesAsync();

                    return await Task.FromException<Guid>(
                        new InvalidOperationException(
                            "Simulated transaction failure"));
                }));

        // Verify from a different DbContext.
        using var verificationScope =
            factory.Services.CreateScope();

        var verificationContext = verificationScope
            .ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        (await verificationContext.Appointments
            .AsNoTracking()
            .AnyAsync(a => a.Id == appointment.Id))
            .Should().BeFalse();

        (await verificationContext.AuditLogs
            .AsNoTracking()
            .AnyAsync(a =>
                a.EntityType == "Appointment" &&
                a.EntityId == appointment.Id))
            .Should().BeFalse();
    }

    private static async Task<Appointment> CreateAppointmentAsync(
        MedicalOfficeDbContext context)
    {
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

        context.Patients.Add(patient);
        context.Doctors.Add(doctor);

        await context.SaveChangesAsync();
        context.ChangeTracker.Clear();

        var startTime = new DateTime(
            2026, 11, 10, 10, 0, 0, DateTimeKind.Utc);

        return new Appointment
        {
            Id = Guid.NewGuid(),
            PatientId = patient.Id,
            DoctorId = doctor.Id,
            StartTime = startTime,
            EndTime = startTime.AddMinutes(30)
        };
    }
}
