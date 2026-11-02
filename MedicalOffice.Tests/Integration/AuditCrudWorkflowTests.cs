
using FluentAssertions;
using MedicalOffice.Application.Doctors;
using MedicalOffice.Application.Patients;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;

namespace MedicalOffice.Tests.Integration;

public class AuditCrudWorkflowTests
{
    [Fact]
    public async Task PatientCrud_ShouldGenerateAttributedAuditHistory()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            await db.Database.EnsureCreatedAsync();
        }

        // Create
        var createResponse = await client.PostAsJsonAsync(
            "/api/patients",
            new
            {
                FirstName = "Test",
                LastName = "Patient"
            });

        createResponse.StatusCode.Should()
            .Be(HttpStatusCode.Created);

        var patient = await createResponse.Content
            .ReadFromJsonAsync<PatientDto>();

        patient.Should().NotBeNull();

        var patientId = patient!.Id;

        // Update
        var updateResponse = await client.PutAsJsonAsync(
            $"/api/patients/{patientId}",
            new
            {
                FirstName = "Updated",
                LastName = "Patient"
            });

        updateResponse.StatusCode.Should()
            .Be(HttpStatusCode.NoContent);

        // Delete
        var deleteResponse = await client.DeleteAsync(
            $"/api/patients/{patientId}");

        deleteResponse.StatusCode.Should()
            .Be(HttpStatusCode.NoContent);

        // Verify audit history
        using var verificationScope =
            factory.Services.CreateScope();

        var context = verificationScope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var logs = await context.AuditLogs
            .AsNoTracking()
            .Where(a =>
                a.EntityType == "Patient" &&
                a.EntityId == patientId)
            .ToListAsync();

        logs.Should().HaveCount(3);

        logs.Should().ContainSingle(
            a => a.Action == "Created");

        logs.Should().ContainSingle(
            a => a.Action == "Updated");

        logs.Should().ContainSingle(
            a => a.Action == "Deleted");

        logs.Should().OnlyContain(
            a => a.UserId == "test-user-id");

        logs.Should().OnlyContain(
            a => a.ChangesJson == null);

        (await context.Patients
            .AsNoTracking()
            .AnyAsync(p => p.Id == patientId))
            .Should().BeFalse();
    }


    [Fact]
    public async Task DoctorCrud_ShouldGenerateAttributedAuditHistory()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        // Initialize the test database.
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            await db.Database.EnsureCreatedAsync();
        }

        // Create
        var createResponse = await client.PostAsJsonAsync(
            "/api/doctors",
            new
            {
                FirstName = "Test",
                LastName = "Doctor",
                Specialty = "Cardiology",
                Email = "doctor@example.com"
            });

        createResponse.StatusCode.Should()
            .Be(HttpStatusCode.Created);

        var doctor = await createResponse.Content
            .ReadFromJsonAsync<DoctorDto>();

        doctor.Should().NotBeNull();

        var doctorId = doctor!.Id;

        // Update
        var updateResponse = await client.PutAsJsonAsync(
            $"/api/doctors/{doctorId}",
            new
            {
                FirstName = "Updated",
                LastName = "Doctor",
                Specialty = "Neurology",
                Email = "doctor@example.com"
            });

        updateResponse.StatusCode.Should()
            .Be(HttpStatusCode.NoContent);

        // Delete
        var deleteResponse = await client.DeleteAsync(
            $"/api/doctors/{doctorId}");

        deleteResponse.StatusCode.Should()
            .Be(HttpStatusCode.NoContent);

        // Verify audit history.
        using var verificationScope =
            factory.Services.CreateScope();

        var context = verificationScope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var logs = await context.AuditLogs
            .AsNoTracking()
            .Where(a =>
                a.EntityType == "Doctor" &&
                a.EntityId == doctorId)
            .ToListAsync();

        logs.Should().HaveCount(3);

        logs.Should().ContainSingle(
            a => a.Action == "Created");

        logs.Should().ContainSingle(
            a => a.Action == "Updated");

        logs.Should().ContainSingle(
            a => a.Action == "Deleted");

        logs.Should().OnlyContain(
            a => a.UserId == "test-user-id");

        logs.Should().OnlyContain(
            a => a.ChangesJson == null);

        // The doctor is deleted, but audit history remains.
        (await context.Doctors
            .AsNoTracking()
            .AnyAsync(d => d.Id == doctorId))
            .Should().BeFalse();
    }

}
