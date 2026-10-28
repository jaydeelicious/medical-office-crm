using FluentAssertions;
using MedicalOffice.Application.Appointments;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Domain.Enums;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using System.Data;
using System.Data.Common;
using System.Net;
using System.Net.Http.Json;

namespace MedicalOffice.Tests.Integration;

public class AppointmentConcurrencyTests
{
    [Fact]
    public async Task SqlServerFactory_CreatesDatabaseSuccessfully()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            using var scope = factory.Services.CreateScope();

            var db = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            db.Database.IsSqlServer().Should().BeTrue();

            (await db.Database.CanConnectAsync())
                .Should().BeTrue();
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    [Fact]
    public async Task CreateAppointment_ConcurrentRequests_PreventsDoubleBooking()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();

            // Seed one patient and one doctor.
            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider
                    .GetRequiredService<MedicalOfficeDbContext>();

                db.Patients.Add(new Patient
                {
                    Id = patientId,
                    FirstName = "John",
                    LastName = "Doe"
                });

                db.Doctors.Add(new Doctor
                {
                    Id = doctorId,
                    FirstName = "Maria",
                    LastName = "Smith",
                    Specialty = "Cardiology"
                });

                await db.SaveChangesAsync();
            }

            using var client = factory.CreateClient();

            var request = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = new DateTime(2026, 11, 10, 10, 0, 0),
                EndTime = new DateTime(2026, 11, 10, 11, 0, 0)
            };

            // Start both requests without awaiting either individually.
            var firstRequest = client.PostAsJsonAsync(
                "/api/appointments",
                request);

            var secondRequest = client.PostAsJsonAsync(
                "/api/appointments",
                request);

            var responses = await Task.WhenAll(
                firstRequest,
                secondRequest);

            try
            {
                responses.Count(r =>
                    r.StatusCode == HttpStatusCode.Created)
                    .Should().Be(1);

                responses.Count(r =>
                    r.StatusCode == HttpStatusCode.Conflict)
                    .Should().Be(1);

                using var verificationScope =
                    factory.Services.CreateScope();

                var verificationDb = verificationScope.ServiceProvider
                    .GetRequiredService<MedicalOfficeDbContext>();

                var appointments = await verificationDb.Appointments
                    .AsNoTracking()
                    .Where(a => a.DoctorId == doctorId)
                    .ToListAsync();

                appointments.Should().ContainSingle();

                appointments[0].StartTime.Should()
                    .Be(request.StartTime);

                appointments[0].EndTime.Should()
                    .Be(request.EndTime);
            }
            finally
            {
                foreach (var response in responses)
                {
                    response.Dispose();
                }
            }
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    [Fact]
    public async Task CreateAppointment_ConcurrentPartialOverlap_PreventsDoubleBooking()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();

            using (var scope = factory.Services.CreateScope())
            {
                var db = scope.ServiceProvider
                    .GetRequiredService<MedicalOfficeDbContext>();

                db.Patients.Add(new Patient
                {
                    Id = patientId,
                    FirstName = "John",
                    LastName = "Doe"
                });

                db.Doctors.Add(new Doctor
                {
                    Id = doctorId,
                    FirstName = "Maria",
                    LastName = "Smith",
                    Specialty = "Cardiology"
                });

                await db.SaveChangesAsync();
            }

            using var client = factory.CreateClient();

            var firstAppointment = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = new DateTime(2026, 11, 10, 10, 0, 0),
                EndTime = new DateTime(2026, 11, 10, 11, 0, 0)
            };

            var secondAppointment = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = new DateTime(2026, 11, 10, 10, 30, 0),
                EndTime = new DateTime(2026, 11, 10, 11, 30, 0)
            };

            var firstRequest = client.PostAsJsonAsync(
                "/api/appointments",
                firstAppointment);

            var secondRequest = client.PostAsJsonAsync(
                "/api/appointments",
                secondAppointment);

            var responses = await Task.WhenAll(
                firstRequest,
                secondRequest);

            try
            {
                responses.Count(r => r.StatusCode == HttpStatusCode.Created)
                    .Should().Be(1);

                responses.Count(r => r.StatusCode == HttpStatusCode.Conflict)
                    .Should().Be(1);

                using var scope = factory.Services.CreateScope();

                var db = scope.ServiceProvider
                    .GetRequiredService<MedicalOfficeDbContext>();

                var appointments = await db.Appointments
                    .AsNoTracking()
                    .Where(a => a.DoctorId == doctorId)
                    .ToListAsync();

                appointments.Should().ContainSingle();

                var saved = appointments.Single();

                var matchesFirst =
                    saved.StartTime == firstAppointment.StartTime &&
                    saved.EndTime == firstAppointment.EndTime;

                var matchesSecond =
                    saved.StartTime == secondAppointment.StartTime &&
                    saved.EndTime == secondAppointment.EndTime;

                (matchesFirst || matchesSecond).Should().BeTrue();
            }
            finally
            {
                foreach (var response in responses)
                    response.Dispose();
            }
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    [Fact]
    public async Task CreateAppointment_WaitsForDoctorLock_ThenRejectsOverlap()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();

            using (var seedScope = factory.Services.CreateScope())
            {
                var seedDb = seedScope.ServiceProvider
                    .GetRequiredService<MedicalOfficeDbContext>();

                seedDb.Patients.Add(new Patient
                {
                    Id = patientId,
                    FirstName = "John",
                    LastName = "Doe"
                });

                seedDb.Doctors.Add(new Doctor
                {
                    Id = doctorId,
                    FirstName = "Maria",
                    LastName = "Smith",
                    Specialty = "Cardiology"
                });

                await seedDb.SaveChangesAsync();
            }

            using var lockScope = factory.Services.CreateScope();

            var lockDb = lockScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            await using var transaction =
                await lockDb.Database.BeginTransactionAsync(
                    IsolationLevel.ReadCommitted);

            // Hold the same lock used by production appointment creation.
            var lockResult = await AcquireDoctorLockAsync(
                lockDb,
                doctorId);

            lockResult.Should().BeGreaterThanOrEqualTo(0);

            using var client = factory.CreateClient();

            var request = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = new DateTime(2026, 11, 10, 10, 0, 0),
                EndTime = new DateTime(2026, 11, 10, 11, 0, 0)
            };

            // Start the HTTP request while the lock is held.
            var bookingTask = client.PostAsJsonAsync(
                "/api/appointments",
                request);

            // Allow the competing request to begin.
            await Task.Delay(300);

            // The booking must not finish while we hold the lock.
            bookingTask.IsCompleted.Should().BeFalse();

            // Insert a conflicting appointment while holding the lock.
            lockDb.Appointments.Add(new Appointment
            {
                Id = Guid.NewGuid(),
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                Status = AppointmentStatus.Scheduled
            });

            await lockDb.SaveChangesAsync();

            // Commit releases the lock.
            await transaction.CommitAsync();

            using var response = await bookingTask.WaitAsync(
                TimeSpan.FromSeconds(15));

            response.StatusCode.Should().Be(
                HttpStatusCode.Conflict);

            using var verifyScope = factory.Services.CreateScope();

            var verifyDb = verifyScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var appointmentCount = await verifyDb.Appointments
                .CountAsync(a => a.DoctorId == doctorId);

            appointmentCount.Should().Be(1);
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    [Fact]
    public async Task CreateAppointment_DifferentDoctor_DoesNotWaitForExistingDoctorLock()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var patientId = Guid.NewGuid();
            var doctorAId = Guid.NewGuid();
            var doctorBId = Guid.NewGuid();

            using (var seedScope = factory.Services.CreateScope())
            {
                var db = seedScope.ServiceProvider
                    .GetRequiredService<MedicalOfficeDbContext>();

                db.Patients.Add(new Patient
                {
                    Id = patientId,
                    FirstName = "John",
                    LastName = "Doe"
                });

                db.Doctors.AddRange(
                    new Doctor
                    {
                        Id = doctorAId,
                        FirstName = "Maria",
                        LastName = "Smith",
                        Specialty = "Cardiology"
                    },
                    new Doctor
                    {
                        Id = doctorBId,
                        FirstName = "James",
                        LastName = "Brown",
                        Specialty = "Neurology"
                    });

                await db.SaveChangesAsync();
            }

            using var lockScope = factory.Services.CreateScope();

            var lockDb = lockScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            await using var transaction =
                await lockDb.Database.BeginTransactionAsync(
                    IsolationLevel.ReadCommitted);

            var lockResult = await AcquireDoctorLockAsync(
                lockDb,
                doctorAId);

            lockResult.Should().BeGreaterThanOrEqualTo(0);

            using var client = factory.CreateClient();

            var request = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = doctorBId,
                StartTime = new DateTime(2026, 11, 10, 10, 0, 0),
                EndTime = new DateTime(2026, 11, 10, 11, 0, 0)
            };

            // Doctor A's lock remains held throughout Doctor B's request.
            using var response = await client.PostAsJsonAsync(
                    "/api/appointments",
                    request)
                .WaitAsync(TimeSpan.FromSeconds(5));

            response.StatusCode.Should().Be(HttpStatusCode.Created);

            // Release Doctor A's lock.
            await transaction.RollbackAsync();

            using var verifyScope = factory.Services.CreateScope();

            var verifyDb = verifyScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var appointment = await verifyDb.Appointments
                .SingleAsync(a => a.DoctorId == doctorBId);

            appointment.StartTime.Should().Be(request.StartTime);
            appointment.EndTime.Should().Be(request.EndTime);
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    private static async Task<int> AcquireDoctorLockAsync(
    MedicalOfficeDbContext db,
    Guid doctorId)
    {
        var connection = db.Database.GetDbConnection();

        await using var command = connection.CreateCommand();

        command.Transaction =
            db.Database.CurrentTransaction!.GetDbTransaction();

        command.CommandText = """
        DECLARE @result int;

        EXEC @result = sp_getapplock
            @Resource = @resource,
            @LockMode = 'Exclusive',
            @LockOwner = 'Transaction',
            @LockTimeout = 10000;

        SELECT @result;
        """;

        var parameter = command.CreateParameter();
        parameter.ParameterName = "@resource";
        parameter.Value = $"appointment:doctor:{doctorId:N}";

        command.Parameters.Add(parameter);

        return Convert.ToInt32(
            await command.ExecuteScalarAsync());
    }
}