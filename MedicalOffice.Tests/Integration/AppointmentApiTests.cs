using FluentAssertions;
using MedicalOffice.Application.Appointments;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Domain.Enums;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;

namespace MedicalOffice.Tests.Integration
{
    public class AppointmentApiTests
    {
        [Fact]
        public async Task GetAll_WhenNoAppointmentsExist_ReturnsOk()
        {
            // Arrange
            using var factory = new CustomWebApplicationFactory();
            using var client = factory.CreateClient();

            using (var scope = factory.Services.CreateScope())
            {
                var context = scope.ServiceProvider
                    .GetRequiredService<MedicalOfficeDbContext>();

                await context.Database.EnsureCreatedAsync();
            }

            // Act 
            var response = await client.GetAsync("/api/appointments");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);

            var appointments = await response.Content
                .ReadFromJsonAsync<List<object>>();

            appointments.Should().NotBeNull();
            appointments.Should().BeEmpty();
        }


        [Fact]
        public async Task CreateAppointment_WhenRequestIsValid_ReturnsCreated()
        {
            // Arrange
            using var factory = new CustomWebApplicationFactory();
            using var client = factory.CreateClient();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();

            using (var scope = factory.Services.CreateScope())
            {
                var context = scope.ServiceProvider
                    .GetRequiredService<MedicalOfficeDbContext>();

                await context.Database.EnsureCreatedAsync();

                context.Patients.Add(new Patient
                {
                    Id = patientId,
                    FirstName = "John",
                    LastName = "Doe"
                });

                context.Doctors.Add(new Doctor
                {
                    Id = doctorId,
                    FirstName = "Maria",
                    LastName = "Smith",
                    Specialty = "Cardiology"
                });

                await context.SaveChangesAsync();
            }

            var request = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = new DateTime(2026, 10, 15, 10, 0, 0),
                EndTime = new DateTime(2026, 10, 15, 11, 0, 0),
                Notes = "Initial consultation"
            };

            // Act
            var response = await client.PostAsJsonAsync(
                "/api/appointments",
                request);

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.Created);

            var result = await response.Content
                .ReadFromJsonAsync<AppointmentDto>();

            result.Should().NotBeNull();
            result!.PatientId.Should().Be(patientId);
            result.DoctorId.Should().Be(doctorId);
            result.Status.Should().Be(AppointmentStatus.Scheduled);

            // Verify persistence in the database
            using var verificationScope = factory.Services.CreateScope();

            var verificationContext = verificationScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var savedAppointment = await verificationContext.Appointments
                .SingleAsync(a => a.Id == result.Id);

            savedAppointment.PatientId.Should().Be(patientId);
            savedAppointment.DoctorId.Should().Be(doctorId);
        }


        [Fact]
        public async Task CreateAppointment_WhenTimeRangeIsInvalid_ReturnsBadRequest()
        {
            // Arrange
            using var factory = new CustomWebApplicationFactory();
            using var client = factory.CreateClient();

            var request = new CreateAppointmentRequest
            {
                PatientId = Guid.NewGuid(),
                DoctorId = Guid.NewGuid(),
                StartTime = new DateTime(2026, 10, 15, 12, 0, 0),
                EndTime = new DateTime(2026, 10, 15, 11, 0, 0)
            };

            // Act
            var response = await client.PostAsJsonAsync(
                "/api/appointments",
                request);

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);

            var problem = await response.Content
                .ReadFromJsonAsync<ValidationProblemDetails>();

            problem.Should().NotBeNull();
            problem!.Errors.Should().ContainKey("StartTime");
        }


        [Fact]
        public async Task CreateAppointment_WhenDoctorDoesNotExist_ReturnsNotFound()
        {
            // Arrange
            using var factory = new CustomWebApplicationFactory();
            using var client = factory.CreateClient();

            var patientId = Guid.NewGuid();

            using (var scope = factory.Services.CreateScope())
            {
                var context = scope.ServiceProvider
                    .GetRequiredService<MedicalOfficeDbContext>();

                await context.Database.EnsureCreatedAsync();

                context.Patients.Add(new Patient
                {
                    Id = patientId,
                    FirstName = "John",
                    LastName = "Doe"
                });

                await context.SaveChangesAsync();
            }

            var request = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = Guid.NewGuid(),
                StartTime = new DateTime(2026, 10, 15, 10, 0, 0),
                EndTime = new DateTime(2026, 10, 15, 11, 0, 0)
            };

            // Act
            var response = await client.PostAsJsonAsync(
                "/api/appointments",
                request);

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        }


        [Fact]
        public async Task CreateAppointment_WhenDoctorIsBooked_ReturnsConflict()
        {
            // Arrange
            using var factory = new CustomWebApplicationFactory();
            using var client = factory.CreateClient();

            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();

            using (var scope = factory.Services.CreateScope())
            {
                var context = scope.ServiceProvider
                    .GetRequiredService<MedicalOfficeDbContext>();

                await context.Database.EnsureCreatedAsync();

                context.Patients.Add(new Patient
                {
                    Id = patientId,
                    FirstName = "John",
                    LastName = "Doe"
                });

                context.Doctors.Add(new Doctor
                {
                    Id = doctorId,
                    FirstName = "Maria",
                    LastName = "Smith",
                    Specialty = "Cardiology"
                });

                await context.SaveChangesAsync();
            }

            var firstRequest = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = new DateTime(2026, 10, 15, 10, 0, 0),
                EndTime = new DateTime(2026, 10, 15, 11, 0, 0)
            };

            var overlappingRequest = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = new DateTime(2026, 10, 15, 10, 30, 0),
                EndTime = new DateTime(2026, 10, 15, 11, 30, 0)
            };

            // Act
            var firstResponse = await client.PostAsJsonAsync(
                "/api/appointments", firstRequest);

            var secondResponse = await client.PostAsJsonAsync(
                "/api/appointments", overlappingRequest);

            // Assert
            firstResponse.StatusCode.Should().Be(HttpStatusCode.Created);
            secondResponse.StatusCode.Should().Be(HttpStatusCode.Conflict);

            // The rejected request must not create another appointment.
            using var verificationScope = factory.Services.CreateScope();

            var verificationContext = verificationScope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var count = await verificationContext.Appointments.CountAsync();

            count.Should().Be(1);
        }


        [Fact]
        public async Task GetAll_WhenDoctorIdProvided_ReturnsOnlyDoctorsAppointments()
        {
            // Arrange
            using var factory = new CustomWebApplicationFactory();
            using var client = factory.CreateClient();

            var (doctor1Id, _, appointmentIds) =
                await SeedAppointmentsAsync(factory);

            // Act
            var response = await client.GetAsync(
                $"/api/appointments?doctorId={doctor1Id}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);

            var result = await response.Content
                .ReadFromJsonAsync<List<AppointmentDto>>();

            result.Should().NotBeNull();
            result.Should().HaveCount(3);

            result!.Should().OnlyContain(
                a => a.DoctorId == doctor1Id);

            result.Select(a => a.Id)
                .Should().BeEquivalentTo(appointmentIds.Take(3));
        }


        [Fact]
        public async Task GetAll_WhenDateProvided_ReturnsOnlyAppointmentsOnThatDate()
        {
            // Arrange
            using var factory = new CustomWebApplicationFactory();
            using var client = factory.CreateClient();

            var (_, _, appointmentIds) =
                await SeedAppointmentsAsync(factory);

            // Act
            var response = await client.GetAsync(
                "/api/appointments?date=2026-10-15");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);

            var result = await response.Content
                .ReadFromJsonAsync<List<AppointmentDto>>();

            result.Should().NotBeNull();
            result.Should().HaveCount(3);

            result!.Should().OnlyContain(
                a => DateOnly.FromDateTime(a.StartTime)
                     == new DateOnly(2026, 10, 15));

            result.Select(a => a.Id)
                .Should().BeEquivalentTo(new[]
                {
            appointmentIds[0],
            appointmentIds[1],
            appointmentIds[3]
                });
        }


        [Fact]
        public async Task GetAll_WhenDoctorAndDateProvided_AppliesBothFilters()
        {
            // Arrange
            using var factory = new CustomWebApplicationFactory();
            using var client = factory.CreateClient();

            var (doctor1Id, _, appointmentIds) =
                await SeedAppointmentsAsync(factory);

            // Act
            var response = await client.GetAsync(
                $"/api/appointments?doctorId={doctor1Id}&date=2026-10-15");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);

            var result = await response.Content
                .ReadFromJsonAsync<List<AppointmentDto>>();

            result.Should().NotBeNull();
            result.Should().HaveCount(2);

            result!.Should().OnlyContain(
                a => a.DoctorId == doctor1Id &&
                     DateOnly.FromDateTime(a.StartTime)
                     == new DateOnly(2026, 10, 15));

            result.Select(a => a.Id)
                .Should().BeEquivalentTo(new[]
                {
            appointmentIds[0],
            appointmentIds[1]
                });
        }


        private static async Task<(Guid Doctor1Id, Guid Doctor2Id, Guid[] AppointmentIds)>
            SeedAppointmentsAsync(CustomWebApplicationFactory factory)
        {
            using var scope = factory.Services.CreateScope();

            var context = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            await context.Database.EnsureCreatedAsync();

            var patientId = Guid.NewGuid();
            var doctor1Id = Guid.NewGuid();
            var doctor2Id = Guid.NewGuid();

            context.Patients.Add(new Patient
            {
                Id = patientId,
                FirstName = "Κώστας",
                LastName = "Παπαδόπουλος"
            });

            context.Doctors.AddRange(
                new Doctor
                {
                    Id = doctor1Id,
                    FirstName = "Μαρία",
                    LastName = "Σμίθου",
                    Specialty = "Καρδιολόγος"
                },
                new Doctor
                {
                    Id = doctor2Id,
                    FirstName = "Αλέξανδρος",
                    LastName = "Καφές",
                    Specialty = "Νευρολόγος"
                });

            var appointments = new[]
            {
                new Appointment
                {
                    Id = Guid.NewGuid(),
                    PatientId = patientId,
                    DoctorId = doctor1Id,
                    StartTime = new DateTime(2026, 10, 15, 10, 0, 0),
                    EndTime = new DateTime(2026, 10, 15, 11, 0, 0),
                    Status = AppointmentStatus.Scheduled
                },
                new Appointment
                {
                    Id = Guid.NewGuid(),
                    PatientId = patientId,
                    DoctorId = doctor1Id,
                    StartTime = new DateTime(2026, 10, 15, 12, 0, 0),
                    EndTime = new DateTime(2026, 10, 15, 13, 0, 0),
                    Status = AppointmentStatus.Scheduled
                },
                new Appointment
                {
                    Id = Guid.NewGuid(),
                    PatientId = patientId,
                    DoctorId = doctor1Id,
                    StartTime = new DateTime(2026, 10, 16, 10, 0, 0),
                    EndTime = new DateTime(2026, 10, 16, 11, 0, 0),
                    Status = AppointmentStatus.Scheduled
                },
                new Appointment
                {
                    Id = Guid.NewGuid(),
                    PatientId = patientId,
                    DoctorId = doctor2Id,
                    StartTime = new DateTime(2026, 10, 15, 10, 0, 0),
                    EndTime = new DateTime(2026, 10, 15, 11, 0, 0),
                    Status = AppointmentStatus.Scheduled
                }
            };

            context.Appointments.AddRange(appointments);

            await context.SaveChangesAsync();

            return (
                doctor1Id,
                doctor2Id,
                appointments.Select(a => a.Id).ToArray()
            );
        }
    }
}
