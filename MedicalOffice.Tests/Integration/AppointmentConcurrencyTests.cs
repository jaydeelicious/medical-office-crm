using FluentAssertions;
using MedicalOffice.Application.Appointments;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Domain.Enums;
using MedicalOffice.Infrastructure.Persistence;
using MedicalOffice.Application.Exceptions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using Microsoft.Extensions.DependencyInjection;
using System.Data;
using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

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

                var conflictResponse = responses.Single(
                    r => r.StatusCode == HttpStatusCode.Conflict);

                using var conflictJson = JsonDocument.Parse(
                    await conflictResponse.Content.ReadAsStringAsync());

                conflictJson.RootElement
                    .GetProperty("code")
                    .GetString()
                    .Should().Be(ConflictCodes.AppointmentOverlap);

                conflictJson.RootElement
                    .GetProperty("status")
                    .GetInt32()
                    .Should().Be(409);

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

    [Fact]
    public async Task RescheduleAppointment_ConcurrentRequests_PreventsOverlap()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();
            var firstId = Guid.NewGuid();
            var secondId = Guid.NewGuid();

            var day = new DateTime(2026, 11, 10);

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

                db.Appointments.AddRange(
                    new Appointment
                    {
                        Id = firstId,
                        PatientId = patientId,
                        DoctorId = doctorId,
                        StartTime = day.AddHours(9),
                        EndTime = day.AddHours(10),
                        Status = AppointmentStatus.Scheduled
                    },
                    new Appointment
                    {
                        Id = secondId,
                        PatientId = patientId,
                        DoctorId = doctorId,
                        StartTime = day.AddHours(11),
                        EndTime = day.AddHours(12),
                        Status = AppointmentStatus.Scheduled
                    });

                await db.SaveChangesAsync();
            }

            using var client = factory.CreateClient();

            var firstRequest = new RescheduleAppointmentRequest
            {
                StartTime = day.AddHours(14),
                EndTime = day.AddHours(15),
                RowVersion = await GetRowVersionAsync(factory, firstId)
            };

            var secondRequest = new RescheduleAppointmentRequest
            {
                StartTime = day.AddHours(14),
                EndTime = day.AddHours(15),
                RowVersion = await GetRowVersionAsync(factory, secondId)
            };

            var firstTask = client.PutAsJsonAsync(
                $"/api/appointments/{firstId}/reschedule",
                firstRequest);

            var secondTask = client.PutAsJsonAsync(
                $"/api/appointments/{secondId}/reschedule",
                secondRequest);

            var responses = await Task.WhenAll(
                firstTask,
                secondTask);

            try
            {
                responses.Count(r =>
                    r.StatusCode == HttpStatusCode.NoContent)
                    .Should().Be(1);

                responses.Count(r =>
                    r.StatusCode == HttpStatusCode.Conflict)
                    .Should().Be(1);

                using var scope = factory.Services.CreateScope();

                var db = scope.ServiceProvider
                    .GetRequiredService<MedicalOfficeDbContext>();

                var appointments = await db.Appointments
                    .AsNoTracking()
                    .Where(a => a.DoctorId == doctorId)
                    .ToListAsync();

                appointments.Should().HaveCount(2);

                // Only one appointment can occupy 14:00–15:00.
                appointments.Count(a =>
                    a.StartTime == firstRequest.StartTime &&
                    a.EndTime == firstRequest.EndTime)
                    .Should().Be(1);

                // The rejected appointment keeps its original time.
                appointments.Count(a =>
                    a.StartTime == day.AddHours(9) ||
                    a.StartTime == day.AddHours(11))
                    .Should().Be(1);
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
    public async Task CreateAndReschedule_ConcurrentRequests_PreventOverlap()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();
            var appointmentId = Guid.NewGuid();

            var day = new DateTime(2026, 11, 10);

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

                db.Appointments.Add(new Appointment
                {
                    Id = appointmentId,
                    PatientId = patientId,
                    DoctorId = doctorId,
                    StartTime = day.AddHours(9),
                    EndTime = day.AddHours(10),
                    Status = AppointmentStatus.Scheduled
                });

                await db.SaveChangesAsync();
            }

            using var client = factory.CreateClient();

            var createRequest = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = day.AddHours(14),
                EndTime = day.AddHours(15)
            };

            var rescheduleRequest = new RescheduleAppointmentRequest
            {
                StartTime = day.AddHours(14),
                EndTime = day.AddHours(15),
                RowVersion = await GetRowVersionAsync(factory, appointmentId)
            };

            var createTask = client.PostAsJsonAsync(
                "/api/appointments",
                createRequest);

            var rescheduleTask = client.PutAsJsonAsync(
                $"/api/appointments/{appointmentId}/reschedule",
                rescheduleRequest);

            var responses = await Task.WhenAll(
                createTask,
                rescheduleTask);

            try
            {
                responses.Count(r =>
                    r.StatusCode is HttpStatusCode.Created
                        or HttpStatusCode.NoContent)
                    .Should().Be(1);

                responses.Count(r =>
                    r.StatusCode == HttpStatusCode.Conflict)
                    .Should().Be(1);

                using var verifyScope = factory.Services.CreateScope();

                var verifyDb = verifyScope.ServiceProvider
                    .GetRequiredService<MedicalOfficeDbContext>();

                var appointments = await verifyDb.Appointments
                    .AsNoTracking()
                    .Where(a => a.DoctorId == doctorId)
                    .ToListAsync();

                appointments.Count(a =>
                    a.StartTime == day.AddHours(14) &&
                    a.EndTime == day.AddHours(15))
                    .Should().Be(1);

                // If creation won, the original appointment
                // must remain at 09:00–10:00.
                // If rescheduling won, no new appointment is created.
                appointments.Should().HaveCount(
                    responses.Any(r =>
                        r.StatusCode == HttpStatusCode.Created)
                        ? 2
                        : 1);
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
    public async Task ReactivateAppointment_WhenSlotOccupied_ReturnsConflict()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();
            var cancelledId = Guid.NewGuid();
            var activeId = Guid.NewGuid();

            var day = new DateTime(2026, 11, 10);

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

                db.Appointments.AddRange(
                    new Appointment
                    {
                        Id = cancelledId,
                        PatientId = patientId,
                        DoctorId = doctorId,
                        StartTime = day.AddHours(10),
                        EndTime = day.AddHours(11),
                        Status = AppointmentStatus.Cancelled
                    },
                    new Appointment
                    {
                        Id = activeId,
                        PatientId = patientId,
                        DoctorId = doctorId,
                        StartTime = day.AddHours(10),
                        EndTime = day.AddHours(11),
                        Status = AppointmentStatus.Scheduled
                    });

                await db.SaveChangesAsync();
            }

            using var client = factory.CreateClient();

            var request = new UpdateAppointmentStatusRequest
            {
                Status = AppointmentStatus.Scheduled,
                RowVersion = await GetRowVersionAsync(factory, cancelledId)
            };

            using var response = await client.PatchAsJsonAsync(
                $"/api/appointments/{cancelledId}/status",
                request);

            response.StatusCode.Should().Be(HttpStatusCode.Conflict);

            using var verifyScope = factory.Services.CreateScope();

            var verifyDb = verifyScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var cancelledAppointment = await verifyDb.Appointments
                .AsNoTracking()
                .SingleAsync(a => a.Id == cancelledId);

            var activeAppointment = await verifyDb.Appointments
                .AsNoTracking()
                .SingleAsync(a => a.Id == activeId);

            cancelledAppointment.Status.Should()
                .Be(AppointmentStatus.Cancelled);

            activeAppointment.Status.Should()
                .Be(AppointmentStatus.Scheduled);
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    [Fact]
    public async Task ReactivateAndCreate_ConcurrentRequests_PreventOverlap()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();
            var cancelledId = Guid.NewGuid();
            var day = new DateTime(2026, 11, 10);

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

                db.Appointments.Add(new Appointment
                {
                    Id = cancelledId,
                    PatientId = patientId,
                    DoctorId = doctorId,
                    StartTime = day.AddHours(10),
                    EndTime = day.AddHours(11),
                    Status = AppointmentStatus.Cancelled
                });

                await db.SaveChangesAsync();
            }

            using var client = factory.CreateClient();

            var reactivateRequest = new UpdateAppointmentStatusRequest
            {
                Status = AppointmentStatus.Scheduled,
                RowVersion = await GetRowVersionAsync(factory, cancelledId)
            };

            var createRequest = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = day.AddHours(10),
                EndTime = day.AddHours(11)
            };

            var reactivateTask = client.PatchAsJsonAsync(
                $"/api/appointments/{cancelledId}/status",
                reactivateRequest);

            var createTask = client.PostAsJsonAsync(
                "/api/appointments",
                createRequest);

            var responses = await Task.WhenAll(
                reactivateTask,
                createTask);

            try
            {
                responses.Count(r =>
                    r.StatusCode is HttpStatusCode.Created
                        or HttpStatusCode.NoContent)
                    .Should().Be(1);

                responses.Count(r =>
                    r.StatusCode == HttpStatusCode.Conflict)
                    .Should().Be(1);

                using var verifyScope = factory.Services.CreateScope();

                var db = verifyScope.ServiceProvider
                    .GetRequiredService<MedicalOfficeDbContext>();

                var appointments = await db.Appointments
                    .AsNoTracking()
                    .Where(a => a.DoctorId == doctorId)
                    .ToListAsync();

                // Only one non-cancelled appointment occupies the slot.
                appointments.Count(a =>
                    a.Status != AppointmentStatus.Cancelled &&
                    a.StartTime == day.AddHours(10) &&
                    a.EndTime == day.AddHours(11))
                    .Should().Be(1);

                if (responses[0].StatusCode == HttpStatusCode.NoContent)
                {
                    // Reactivation won.
                    appointments.Should().ContainSingle();

                    appointments.Single().Status.Should()
                        .Be(AppointmentStatus.Scheduled);
                }
                else
                {
                    // Creation won.
                    appointments.Should().HaveCount(2);

                    appointments.Single(a => a.Id == cancelledId)
                        .Status.Should().Be(AppointmentStatus.Cancelled);
                }
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

    [Theory]
    [InlineData(
    AppointmentStatus.Cancelled,
    14, 15,
    false)]
    [InlineData(
    AppointmentStatus.Scheduled,
    10, 11,
    true)]
    public async Task RescheduleAppointment_ValidEdgeCases_Succeed(
        AppointmentStatus initialStatus,
        int targetStartHour,
        int targetEndHour,
        bool remainsActive)
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();
            var appointmentId = Guid.NewGuid();

            var day = new DateTime(2026, 11, 10);

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

                db.Appointments.Add(new Appointment
                {
                    Id = appointmentId,
                    PatientId = patientId,
                    DoctorId = doctorId,
                    StartTime = day.AddHours(10),
                    EndTime = day.AddHours(11),
                    Status = initialStatus
                });

                await db.SaveChangesAsync();
            }

            using var client = factory.CreateClient();

            var request = new RescheduleAppointmentRequest
            {
                StartTime = day.AddHours(targetStartHour),
                EndTime = day.AddHours(targetEndHour),
                RowVersion = await GetRowVersionAsync(factory, appointmentId)
            };

            using var response = await client.PutAsJsonAsync(
                $"/api/appointments/{appointmentId}/reschedule",
                request);

            response.StatusCode.Should().Be(
                HttpStatusCode.NoContent);

            using var verifyScope = factory.Services.CreateScope();

            var verifyDb = verifyScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var appointment = await verifyDb.Appointments
                .AsNoTracking()
                .SingleAsync(a => a.Id == appointmentId);

            appointment.StartTime.Should().Be(request.StartTime);
            appointment.EndTime.Should().Be(request.EndTime);

            appointment.Status.Should().Be(
                remainsActive
                    ? AppointmentStatus.Scheduled
                    : AppointmentStatus.Cancelled);
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    [Fact]
    public async Task ReactivateAppointment_WhenSlotAvailable_Succeeds()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();
            var appointmentId = Guid.NewGuid();

            var day = new DateTime(2026, 11, 10);

            using (var verificationScope = factory.Services.CreateScope())
            {
                var db = verificationScope.ServiceProvider
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

                db.Appointments.Add(new Appointment
                {
                    Id = appointmentId,
                    PatientId = patientId,
                    DoctorId = doctorId,
                    StartTime = day.AddHours(10),
                    EndTime = day.AddHours(11),
                    Status = AppointmentStatus.Cancelled
                });

                await db.SaveChangesAsync();
            }

            using var client = factory.CreateClient();

            using var response = await client.PatchAsJsonAsync(
                $"/api/appointments/{appointmentId}/status",
                new UpdateAppointmentStatusRequest
                {
                    Status = AppointmentStatus.Scheduled,
                    RowVersion = await GetRowVersionAsync(factory, appointmentId)
                });

            response.StatusCode.Should().Be(
                HttpStatusCode.NoContent);

            using var scope = factory.Services.CreateScope();

            var verifyDb = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var appointment = await verifyDb.Appointments
                .AsNoTracking()
                .SingleAsync(a => a.Id == appointmentId);

            appointment.Status.Should().Be(
                AppointmentStatus.Scheduled);
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    [Fact]
    public async Task UpdateStatus_WithStaleRowVersion_ReturnsConflict()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();
            var appointmentId = Guid.NewGuid();
            var day = new DateTime(2026, 11, 10);

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

                db.Doctors.Add(new Doctor
                {
                    Id = doctorId,
                    FirstName = "Maria",
                    LastName = "Smith",
                    Specialty = "Cardiology"
                });

                db.Appointments.Add(new Appointment
                {
                    Id = appointmentId,
                    PatientId = patientId,
                    DoctorId = doctorId,
                    StartTime = day.AddHours(10),
                    EndTime = day.AddHours(11),
                    Status = AppointmentStatus.Scheduled
                });

                await db.SaveChangesAsync();
            }

            using var client = factory.CreateClient();

            // Both clients initially have this version.
            var originalVersion = await GetRowVersionAsync(
                factory,
                appointmentId);

            // Client A successfully reschedules.
            using var rescheduleResponse = await client.PutAsJsonAsync(
                $"/api/appointments/{appointmentId}/reschedule",
                new RescheduleAppointmentRequest
                {
                    StartTime = day.AddHours(14),
                    EndTime = day.AddHours(15),
                    RowVersion = originalVersion
                });

            rescheduleResponse.StatusCode.Should().Be(
                HttpStatusCode.NoContent);

            // SQL Server should have generated a new version.
            var updatedVersion = await GetRowVersionAsync(
                factory,
                appointmentId);

            updatedVersion.Should().NotBe(originalVersion);

            // Client B submits an outdated version.
            using var staleResponse = await client.PatchAsJsonAsync(
                $"/api/appointments/{appointmentId}/status",
                new UpdateAppointmentStatusRequest
                {
                    Status = AppointmentStatus.Cancelled,
                    RowVersion = originalVersion
                });

            staleResponse.StatusCode.Should().Be(
                HttpStatusCode.Conflict);

            using var staleJson = JsonDocument.Parse(
                await staleResponse.Content.ReadAsStringAsync());

            staleJson.RootElement
                .GetProperty("code")
                .GetString()
                .Should().Be(ConflictCodes.StaleAppointment);

            staleJson.RootElement
                .GetProperty("status")
                .GetInt32()
                .Should().Be(409);

            // Verify Client A's changes were preserved.
            using var verifyScope = factory.Services.CreateScope();

            var verifyDb = verifyScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var appointment = await verifyDb.Appointments
                .AsNoTracking()
                .SingleAsync(a => a.Id == appointmentId);

            appointment.StartTime.Should().Be(day.AddHours(14));
            appointment.EndTime.Should().Be(day.AddHours(15));
            appointment.Status.Should().Be(AppointmentStatus.Scheduled);

            Convert.ToBase64String(appointment.RowVersion)
                .Should().Be(updatedVersion);
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    [Fact]
    public async Task Reschedule_WithStaleRowVersion_ReturnsConflict()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();
            var appointmentId = Guid.NewGuid();
            var day = new DateTime(2026, 11, 10);

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

                db.Doctors.Add(new Doctor
                {
                    Id = doctorId,
                    FirstName = "Maria",
                    LastName = "Smith",
                    Specialty = "Cardiology"
                });

                db.Appointments.Add(new Appointment
                {
                    Id = appointmentId,
                    PatientId = patientId,
                    DoctorId = doctorId,
                    StartTime = day.AddHours(10),
                    EndTime = day.AddHours(11),
                    Status = AppointmentStatus.Scheduled
                });

                await db.SaveChangesAsync();
            }

            using var client = factory.CreateClient();

            // Both clients initially load version V1.
            var originalVersion = await GetRowVersionAsync(
                factory,
                appointmentId);

            // Client A changes the status.
            using var statusResponse = await client.PatchAsJsonAsync(
                $"/api/appointments/{appointmentId}/status",
                new UpdateAppointmentStatusRequest
                {
                    Status = AppointmentStatus.Completed,
                    RowVersion = originalVersion
                });

            statusResponse.StatusCode.Should().Be(
                HttpStatusCode.NoContent);

            var updatedVersion = await GetRowVersionAsync(
                factory,
                appointmentId);

            updatedVersion.Should().NotBe(originalVersion);

            // Client B attempts to reschedule using V1.
            using var staleResponse = await client.PutAsJsonAsync(
                $"/api/appointments/{appointmentId}/reschedule",
                new RescheduleAppointmentRequest
                {
                    StartTime = day.AddHours(14),
                    EndTime = day.AddHours(15),
                    RowVersion = originalVersion
                });

            staleResponse.StatusCode.Should().Be(
                HttpStatusCode.Conflict);

            // Verify the stale request changed nothing.
            using var verifyScope = factory.Services.CreateScope();

            var verifyDb = verifyScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var appointment = await verifyDb.Appointments
                .AsNoTracking()
                .SingleAsync(a => a.Id == appointmentId);

            appointment.Status.Should().Be(
                AppointmentStatus.Completed);

            appointment.StartTime.Should().Be(day.AddHours(10));
            appointment.EndTime.Should().Be(day.AddHours(11));

            Convert.ToBase64String(appointment.RowVersion)
                .Should().Be(updatedVersion);
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    [Theory]
    [InlineData("")]
    [InlineData("invalid-base64!!!")]
    [InlineData("AQID")]
    public async Task Reschedule_WithInvalidRowVersion_ReturnsBadRequest(
    string rowVersion)
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            using var client = factory.CreateClient();

            using var response = await client.PutAsJsonAsync(
                $"/api/appointments/{Guid.NewGuid()}/reschedule",
                new RescheduleAppointmentRequest
                {
                    StartTime = new DateTime(2026, 11, 10, 14, 0, 0),
                    EndTime = new DateTime(2026, 11, 10, 15, 0, 0),
                    RowVersion = rowVersion
                });

            response.StatusCode.Should().Be(
                HttpStatusCode.BadRequest);
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    [Theory]
    [InlineData("")]
    [InlineData("invalid-base64!!!")]
    [InlineData("AQID")]
    public async Task UpdateStatus_WithInvalidRowVersion_ReturnsBadRequest(
    string rowVersion)
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            using var client = factory.CreateClient();

            using var response = await client.PatchAsJsonAsync(
                $"/api/appointments/{Guid.NewGuid()}/status",
                new UpdateAppointmentStatusRequest
                {
                    Status = AppointmentStatus.Completed,
                    RowVersion = rowVersion
                });

            response.StatusCode.Should().Be(
                HttpStatusCode.BadRequest);
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    [Fact]
    public async Task DeleteAppointment_WithCurrentRowVersion_Succeeds()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var appointmentId = await SeedAppointmentAsync(factory);

            using var client = factory.CreateClient();

            var rowVersion = await GetRowVersionAsync(
                factory,
                appointmentId);

            using var response = await DeleteAppointmentAsync(
                client,
                appointmentId,
                rowVersion);

            response.StatusCode.Should().Be(HttpStatusCode.NoContent);

            using var verificationScope = factory.Services.CreateScope();

            var db = verificationScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var exists = await db.Appointments
                .AnyAsync(a => a.Id == appointmentId);

            exists.Should().BeFalse();
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    [Fact]
    public async Task DeleteAppointment_WithStaleRowVersion_ReturnsConflict()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var appointmentId = await SeedAppointmentAsync(factory);

            using var client = factory.CreateClient();

            // Client A reads V1.
            var originalVersion = await GetRowVersionAsync(
                factory,
                appointmentId);

            // Client B updates the appointment.
            using var updateResponse = await client.PatchAsJsonAsync(
                $"/api/appointments/{appointmentId}/status",
                new UpdateAppointmentStatusRequest
                {
                    Status = AppointmentStatus.Completed,
                    RowVersion = originalVersion
                });

            updateResponse.StatusCode.Should().Be(
                HttpStatusCode.NoContent);

            // SQL Server generates V2.
            var updatedVersion = await GetRowVersionAsync(
                factory,
                appointmentId);

            updatedVersion.Should().NotBe(originalVersion);

            // Client A attempts deletion using stale V1.
            using var deleteResponse = await DeleteAppointmentAsync(
                client,
                appointmentId,
                originalVersion);

            deleteResponse.StatusCode.Should().Be(
                HttpStatusCode.Conflict);

            // Confirm that the appointment was preserved.
            using var verificationScope = factory.Services.CreateScope();

            var db = verificationScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var appointment = await db.Appointments
                .AsNoTracking()
                .SingleAsync(a => a.Id == appointmentId);

            appointment.Status.Should().Be(
                AppointmentStatus.Completed);

            Convert.ToBase64String(appointment.RowVersion)
                .Should().Be(updatedVersion);
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    [Fact]
    public async Task DeleteAppointment_WithoutIfMatch_ReturnsBadRequest()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var appointmentId = await SeedAppointmentAsync(factory);

            using var client = factory.CreateClient();

            using var response = await DeleteAppointmentAsync(
                client,
                appointmentId,
                rowVersion: null);

            response.StatusCode.Should().Be(
                HttpStatusCode.BadRequest);

            using var verificationScope = factory.Services.CreateScope();

            var db = verificationScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var exists = await db.Appointments
                .AnyAsync(a => a.Id == appointmentId);

            exists.Should().BeTrue();
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    [Fact]
    public async Task UpdateStatus_ConcurrentRequests_SameRowVersion_OnlyOneSucceeds()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();
            var appointmentId = Guid.NewGuid();
            var day = new DateTime(2026, 11, 10);

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

                db.Appointments.Add(new Appointment
                {
                    Id = appointmentId,
                    PatientId = patientId,
                    DoctorId = doctorId,
                    StartTime = day.AddHours(10),
                    EndTime = day.AddHours(11),
                    Status = AppointmentStatus.Scheduled
                });

                await db.SaveChangesAsync();
            }

            using var client = factory.CreateClient();

            // Both clients read the same version before updating.
            var originalVersion = await GetRowVersionAsync(
                factory,
                appointmentId);

            var completedRequest = new UpdateAppointmentStatusRequest
            {
                Status = AppointmentStatus.Completed,
                RowVersion = originalVersion
            };

            var cancelledRequest = new UpdateAppointmentStatusRequest
            {
                Status = AppointmentStatus.Cancelled,
                RowVersion = originalVersion
            };

            // Send both requests concurrently.
            var completedTask = client.PatchAsJsonAsync(
                $"/api/appointments/{appointmentId}/status",
                completedRequest);

            var cancelledTask = client.PatchAsJsonAsync(
                $"/api/appointments/{appointmentId}/status",
                cancelledRequest);

            var responses = await Task.WhenAll(
                completedTask,
                cancelledTask);

            try
            {
                responses.Count(r =>
                    r.StatusCode == HttpStatusCode.NoContent)
                    .Should().Be(1);

                responses.Count(r =>
                    r.StatusCode == HttpStatusCode.Conflict)
                    .Should().Be(1);

                // The losing request must report stale data.
                var conflictResponse = responses.Single(r =>
                    r.StatusCode == HttpStatusCode.Conflict);

                using var conflictJson = JsonDocument.Parse(
                    await conflictResponse.Content.ReadAsStringAsync());

                conflictJson.RootElement
                    .GetProperty("code")
                    .GetString()
                    .Should().Be(ConflictCodes.StaleAppointment);

                // Verify persisted state using a fresh DbContext.
                using var verifyScope = factory.Services.CreateScope();

                var verifyDb = verifyScope.ServiceProvider
                    .GetRequiredService<MedicalOfficeDbContext>();

                var savedAppointment = await verifyDb.Appointments
                    .AsNoTracking()
                    .SingleAsync(a => a.Id == appointmentId);

                var winningStatus =
                    responses[0].StatusCode == HttpStatusCode.NoContent
                        ? AppointmentStatus.Completed
                        : AppointmentStatus.Cancelled;

                savedAppointment.Status.Should().Be(winningStatus);

                // A successful modification advances the version.
                Convert.ToBase64String(savedAppointment.RowVersion)
                    .Should().NotBe(originalVersion);
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
    public async Task DeleteAndUpdateStatus_ConcurrentRequests_PreserveConsistency()
    {
        using var factory = new SqlServerWebApplicationFactory();

        try
        {
            await factory.InitializeDatabaseAsync();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();
            var appointmentId = Guid.NewGuid();
            var day = new DateTime(2026, 11, 10);

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

                db.Appointments.Add(new Appointment
                {
                    Id = appointmentId,
                    PatientId = patientId,
                    DoctorId = doctorId,
                    StartTime = day.AddHours(10),
                    EndTime = day.AddHours(11),
                    Status = AppointmentStatus.Scheduled
                });

                await db.SaveChangesAsync();
            }

            using var client = factory.CreateClient();

            var originalVersion = await GetRowVersionAsync(
                factory,
                appointmentId);

            var statusRequest = new UpdateAppointmentStatusRequest
            {
                Status = AppointmentStatus.Completed,
                RowVersion = originalVersion
            };

            using var deleteRequest = new HttpRequestMessage(
                HttpMethod.Delete,
                $"/api/appointments/{appointmentId}");

            deleteRequest.Headers.TryAddWithoutValidation(
                "If-Match",
                $"\"{originalVersion}\"");

            // Both operations use the same original row version.
            var deleteTask = client.SendAsync(deleteRequest);

            var updateTask = client.PatchAsJsonAsync(
                $"/api/appointments/{appointmentId}/status",
                statusRequest);

            using var deleteResponse = await deleteTask;
            using var updateResponse = await updateTask;

            var deleteSucceeded =
                deleteResponse.StatusCode == HttpStatusCode.NoContent;

            var updateSucceeded =
                updateResponse.StatusCode == HttpStatusCode.NoContent;

            // Exactly one operation must succeed.
            (deleteSucceeded ^ updateSucceeded).Should().BeTrue();

            if (deleteSucceeded)
            {
                // Update may find the record already deleted (404),
                // or detect an outdated version (409).
                updateResponse.StatusCode.Should().BeOneOf(
                    HttpStatusCode.NotFound,
                    HttpStatusCode.Conflict);

                if (updateResponse.StatusCode == HttpStatusCode.Conflict)
                {
                    using var conflictJson = JsonDocument.Parse(
                        await updateResponse.Content.ReadAsStringAsync());

                    conflictJson.RootElement.GetProperty("code")
                        .GetString()
                        .Should().Be(ConflictCodes.StaleAppointment);
                }
            }
            else
            {
                // The update won; deletion must reject its stale token.
                deleteResponse.StatusCode.Should().Be(
                    HttpStatusCode.Conflict);

                using var conflictJson = JsonDocument.Parse(
                    await deleteResponse.Content.ReadAsStringAsync());

                conflictJson.RootElement.GetProperty("code")
                    .GetString()
                    .Should().Be(ConflictCodes.StaleAppointment);
            }

            using var verifyScope = factory.Services.CreateScope();

            var verifyDb = verifyScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var savedAppointment = await verifyDb.Appointments
                .AsNoTracking()
                .SingleOrDefaultAsync(a => a.Id == appointmentId);

            if (deleteSucceeded)
            {
                savedAppointment.Should().BeNull();
            }
            else
            {
                savedAppointment.Should().NotBeNull();
                savedAppointment!.Status.Should().Be(
                    AppointmentStatus.Completed);

                Convert.ToBase64String(savedAppointment.RowVersion)
                    .Should().NotBe(originalVersion);
            }
        }
        finally
        {
            await factory.DeleteDatabaseAsync();
        }
    }

    private static async Task<Guid> SeedAppointmentAsync(
    SqlServerWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();

        var db = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var patientId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();
        var appointmentId = Guid.NewGuid();

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

        db.Appointments.Add(new Appointment
        {
            Id = appointmentId,
            PatientId = patientId,
            DoctorId = doctorId,
            StartTime = new DateTime(2026, 11, 10, 10, 0, 0),
            EndTime = new DateTime(2026, 11, 10, 11, 0, 0),
            Status = AppointmentStatus.Scheduled
        });

        await db.SaveChangesAsync();

        return appointmentId;
    }

    private static async Task<HttpResponseMessage> DeleteAppointmentAsync(
    HttpClient client,
    Guid appointmentId,
    string? rowVersion)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Delete,
            $"/api/appointments/{appointmentId}");

        if (rowVersion is not null)
        {
            request.Headers.TryAddWithoutValidation(
                "If-Match",
                $"\"{rowVersion}\"");
        }

        return await client.SendAsync(request);
    }

    private static async Task<string> GetRowVersionAsync(
        SqlServerWebApplicationFactory factory,
        Guid appointmentId)
    {
        using var scope = factory.Services.CreateScope();

        var db = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var rowVersion = await db.Appointments
            .AsNoTracking()
            .Where(a => a.Id == appointmentId)
            .Select(a => a.RowVersion)
            .SingleAsync();

        return Convert.ToBase64String(rowVersion);
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