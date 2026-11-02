
using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using MedicalOffice.Application.Appointments;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Domain.Enums;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MedicalOffice.Tests.Integration;

public class AuditAppointmentWorkflowTests
{
    [Fact]
    public async Task AppointmentLifecycle_ShouldGenerateAttributedAuditHistory()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        Guid patientId;
        Guid doctorId;

        // Arrange: Create the database and required entities.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            await db.Database.EnsureCreatedAsync();

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

            db.Patients.Add(patient);
            db.Doctors.Add(doctor);

            await db.SaveChangesAsync();

            patientId = patient.Id;
            doctorId = doctor.Id;
        }

        var start = new DateTime(
            2026, 11, 10, 10, 0, 0, DateTimeKind.Unspecified);

        // 1. Schedule an appointment.
        var createResponse = await client.PostAsJsonAsync(
            "/api/appointments",
            new
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = start,
                EndTime = start.AddMinutes(30)
            });

        createResponse.StatusCode.Should()
            .Be(HttpStatusCode.Created);

        var appointment = await createResponse.Content
            .ReadFromJsonAsync<AppointmentDto>();

        appointment.Should().NotBeNull();

        var appointmentId = appointment!.Id;
        var rowVersion = appointment.RowVersion;

        // 2. Reschedule the appointment.
        var rescheduledStart = start.AddHours(2);

        var rescheduleResponse = await client.PutAsJsonAsync(
            $"/api/appointments/{appointmentId}/reschedule",
            new
            {
                StartTime = rescheduledStart,
                EndTime = rescheduledStart.AddMinutes(30),
                RowVersion = rowVersion
            });

        rescheduleResponse.StatusCode.Should()
            .Be(HttpStatusCode.NoContent);

        // Fetch the updated row version.
        var rescheduledAppointment = await client
            .GetFromJsonAsync<AppointmentDto>(
                $"/api/appointments/{appointmentId}");

        rescheduledAppointment.Should().NotBeNull();

        rowVersion = rescheduledAppointment!.RowVersion;

        // 3. Change appointment status.
        var statusResponse = await client.PatchAsJsonAsync(
            $"/api/appointments/{appointmentId}/status",
            new
            {
                Status = AppointmentStatus.Completed,
                RowVersion = rowVersion
            });

        statusResponse.StatusCode.Should()
            .Be(HttpStatusCode.NoContent);

        var updatedAppointment = await client
            .GetFromJsonAsync<AppointmentDto>(
                $"/api/appointments/{appointmentId}");

        updatedAppointment.Should().NotBeNull();

        rowVersion = updatedAppointment!.RowVersion;

        // 4. Delete the appointment.
        using var deleteRequest = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/appointments/{appointmentId}");

        deleteRequest.Headers.TryAddWithoutValidation(
            "If-Match",
            $"\"{rowVersion}\"");

        var deleteResponse = await client.SendAsync(deleteRequest);

        deleteResponse.StatusCode.Should()
            .Be(HttpStatusCode.NoContent);

        // 5. Verify the audit history.
        using var verificationScope =
            factory.Services.CreateScope();

        var context = verificationScope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var logs = await context.AuditLogs
            .AsNoTracking()
            .Where(a =>
                a.EntityType == "Appointment" &&
                a.EntityId == appointmentId)
            .ToListAsync();

        logs.Should().HaveCount(4);

        logs.Count(a => a.Action == "Created")
            .Should().Be(1);

        logs.Count(a => a.Action == "Updated")
            .Should().Be(2);

        logs.Count(a => a.Action == "Deleted")
            .Should().Be(1);

        logs.Should().OnlyContain(
            a => a.UserId == "test-user-id");

        logs.Should().OnlyContain(
            a => a.ChangesJson == null);

        (await context.Appointments
            .AsNoTracking()
            .AnyAsync(a => a.Id == appointmentId))
            .Should().BeFalse();
    }


    [Fact]
    public async Task SchedulingConflict_ShouldNotGenerateAuditEvent()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        var (patientId, doctorId) =
            await SeedPatientAndDoctorAsync(factory);

        var start = new DateTime(2026, 11, 10, 10, 0, 0);

        // First appointment succeeds.
        var firstResponse = await client.PostAsJsonAsync(
            "/api/appointments",
            new
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = start,
                EndTime = start.AddMinutes(30)
            });

        firstResponse.StatusCode.Should()
            .Be(HttpStatusCode.Created);

        // Second appointment overlaps the first.
        var conflictResponse = await client.PostAsJsonAsync(
            "/api/appointments",
            new
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = start.AddMinutes(15),
                EndTime = start.AddMinutes(45)
            });

        conflictResponse.StatusCode.Should()
            .Be(HttpStatusCode.Conflict);

        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var appointments = await context.Appointments
            .AsNoTracking()
            .ToListAsync();

        var auditLogs = await context.AuditLogs
            .AsNoTracking()
            .Where(a => a.EntityType == "Appointment")
            .ToListAsync();

        appointments.Should().ContainSingle();
        auditLogs.Should().ContainSingle();

        auditLogs[0].EntityId.Should()
            .Be(appointments[0].Id);

        auditLogs[0].Action.Should().Be("Created");
        auditLogs[0].UserId.Should().Be("test-user-id");
    }


    [Fact]
    public async Task StaleReschedule_ShouldNotGenerateAuditEvent()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        var (patientId, doctorId) =
            await SeedPatientAndDoctorAsync(factory);

        var start = new DateTime(2026, 11, 10, 10, 0, 0);

        var createResponse = await client.PostAsJsonAsync(
            "/api/appointments",
            new
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = start,
                EndTime = start.AddMinutes(30)
            });

        createResponse.StatusCode.Should()
            .Be(HttpStatusCode.Created);

        var appointment = await createResponse.Content
            .ReadFromJsonAsync<AppointmentDto>();

        appointment.Should().NotBeNull();

        var appointmentId = appointment!.Id;
        var originalRowVersion = appointment.RowVersion;

        // First reschedule succeeds.
        var firstUpdate = await client.PutAsJsonAsync(
            $"/api/appointments/{appointmentId}/reschedule",
            new
            {
                StartTime = start.AddHours(1),
                EndTime = start.AddHours(1).AddMinutes(30),
                RowVersion = originalRowVersion
            });

        firstUpdate.StatusCode.Should()
            .Be(HttpStatusCode.NoContent);

        // Second reschedule uses the stale token.
        var staleUpdate = await client.PutAsJsonAsync(
            $"/api/appointments/{appointmentId}/reschedule",
            new
            {
                StartTime = start.AddHours(2),
                EndTime = start.AddHours(2).AddMinutes(30),
                RowVersion = originalRowVersion
            });

        staleUpdate.StatusCode.Should()
            .Be(HttpStatusCode.Conflict);

        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var auditLogs = await context.AuditLogs
            .AsNoTracking()
            .Where(a =>
                a.EntityType == "Appointment" &&
                a.EntityId == appointmentId)
            .ToListAsync();

        // Creation + first successful reschedule only.
        auditLogs.Should().HaveCount(2);

        auditLogs.Should().ContainSingle(
            a => a.Action == "Created");

        auditLogs.Should().ContainSingle(
            a => a.Action == "Updated");

        auditLogs.Should().OnlyContain(
            a => a.UserId == "test-user-id");

        var persistedAppointment = await context.Appointments
            .AsNoTracking()
            .SingleAsync(a => a.Id == appointmentId);

        persistedAppointment.StartTime.Should()
            .Be(start.AddHours(1));
    }


    private static async Task<(Guid PatientId, Guid DoctorId)>
        SeedPatientAndDoctorAsync(
            CustomWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            FirstName = "Audit",
            LastName = "Patient"
        };

        var doctor = new Doctor
        {
            Id = Guid.NewGuid(),
            FirstName = "Audit",
            LastName = "Doctor",
            Specialty = "Cardiology"
        };

        context.Patients.Add(patient);
        context.Doctors.Add(doctor);

        await context.SaveChangesAsync();

        return (patient.Id, doctor.Id);
    }


}
