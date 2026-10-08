using FluentAssertions;
using FluentValidation;
using MedicalOffice.Application.Abstractions;
using MedicalOffice.Application.Appointments;
using MedicalOffice.Application.Exceptions;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Domain.Enums;
using Microsoft.EntityFrameworkCore.Update;
using Moq;

namespace MedicalOffice.Tests.Appointments
{
    public class AppointmentServiceTests
    {
        private readonly Mock<IAppointmentRepository> _appointmentRepositoryMock;
        private readonly Mock<IDoctorRepository> _doctorRepositoryMock;
        private readonly Mock<IPatientRepository> _patientRepositoryMock;

        private readonly Mock<IValidator<CreateAppointmentRequest>> _createValidatorMock;
        private readonly Mock<IValidator<RescheduleAppointmentRequest>> _rescheduleValidatorMock;
        private readonly Mock<IValidator<UpdateAppointmentStatusRequest>> _statusValidatorMock;

        private readonly AppointmentService _service;

        public AppointmentServiceTests()
        {
            _appointmentRepositoryMock = new Mock<IAppointmentRepository>();
            _doctorRepositoryMock = new Mock<IDoctorRepository>();
            _patientRepositoryMock = new Mock<IPatientRepository>();

            _createValidatorMock = new Mock<IValidator<CreateAppointmentRequest>>();
            _rescheduleValidatorMock = new Mock<IValidator<RescheduleAppointmentRequest>>();
            _statusValidatorMock = new Mock<IValidator<UpdateAppointmentStatusRequest>>();

            _service = new AppointmentService(
                _appointmentRepositoryMock.Object,
                _doctorRepositoryMock.Object,
                _patientRepositoryMock.Object,
                _createValidatorMock.Object,
                _rescheduleValidatorMock.Object,
                _statusValidatorMock.Object);
        }

        [Fact]
        public async Task CreateAsync_WhenDoctorHasOverlappingAppointment_ThrowsConflictException()
        {
            // Arrange
            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();

            var request = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = new DateTime(2026, 10, 10, 10, 0, 0),
                EndTime = new DateTime(2026, 10, 10, 11, 0, 0),
                Notes = "Test appointment"
            };

            _createValidatorMock
                .Setup(v => v.ValidateAsync(
                    request, 
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());

            _patientRepositoryMock
                .Setup(r => r.GetByIdAsync(
                    patientId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Patient
                {
                    Id = patientId,
                    FirstName = "John",
                    LastName = "Doe"
                });

            _doctorRepositoryMock
                .Setup(r => r.GetByIdAsync(
                    doctorId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Doctor
                {
                    Id = doctorId,
                    FirstName = "Maria",
                    LastName = "Smith",
                    Specialty = "Cardiology"
                });

            _appointmentRepositoryMock
                .Setup(r => r.HasOverlapAsync(
                    doctorId,
                    request.StartTime,
                    request.EndTime,
                    null,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act
            Func<Task> act = () => _service.CreateAsync(request);

            // Assert
            await act.Should()
                .ThrowAsync<ConflictException>()
                .WithMessage(
                    "The doctor already has an appointment during this time.");
        }

        [Fact]
        public async Task CreateAsync_WhenRequestIsValid_CreatesAppointment()
        {
            // Arrange
            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();

            var request = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = new DateTime(2026, 10, 10, 10, 0, 0),
                EndTime = new DateTime(2026, 10, 10, 11, 0, 0),
                Notes = "Initial consultation"
            };

            _createValidatorMock
                .Setup(v => v.ValidateAsync(
                    request,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());

            _patientRepositoryMock
                .Setup(r => r.GetByIdAsync(
                    patientId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Patient
                {
                    Id = patientId,
                    FirstName = "John",
                    LastName = "Doe"
                });

            _doctorRepositoryMock
                .Setup(r => r.GetByIdAsync(
                    doctorId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Doctor
                {
                    Id = doctorId,
                    FirstName = "Maria",
                    LastName = "Smith",
                    Specialty = "Cardiology"
                });

            _appointmentRepositoryMock
                .Setup(r => r.HasOverlapAsync(
                    doctorId,
                    request.StartTime,
                    request.EndTime,
                    null,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            // Act
            var result = await _service.CreateAsync(request);

            // Assert
            result.Should().NotBeNull();
            result.PatientId.Should().Be(patientId);
            result.DoctorId.Should().Be(doctorId);
            result.StartTime.Should().Be(request.StartTime);
            result.EndTime.Should().Be(request.EndTime);
            result.Status.Should().Be(AppointmentStatus.Scheduled);
            result.Notes.Should().Be(request.Notes);

            _appointmentRepositoryMock.Verify(
                r => r.AddAsync(
                    It.Is<Appointment>(a =>
                        a.PatientId == patientId &&
                        a.DoctorId == doctorId &&
                        a.StartTime == request.StartTime &&
                        a.EndTime == request.EndTime &&
                        a.Status == AppointmentStatus.Scheduled),
                    It.IsAny<CancellationToken>()),
                Times.Once);

            _appointmentRepositoryMock.Verify(
                r => r.SaveChangesAsync(
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task CreateAsync_WhenPatientDoesNotExist_ThrowNotFoundException()
        {
            // Arrange
            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();

            var request = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = new DateTime(2026, 10, 10, 10, 0, 0),
                EndTime = new DateTime(2026, 10, 10, 11, 0, 0)
            };

            _createValidatorMock
                .Setup(v => v.ValidateAsync(
                    request,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());

            _patientRepositoryMock
                .Setup(r => r.GetByIdAsync(
                    patientId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync((Patient?)null);

            // Act 
            Func<Task> act = () => _service.CreateAsync(request);

            // Assert
            await act.Should()
                .ThrowAsync<NotFoundException>()
                .WithMessage("Patient does not exist.");

            _doctorRepositoryMock.Verify(
                r => r.GetByIdAsync(
                    It.IsAny<Guid>(),
                    It.IsAny<CancellationToken>()),
                Times.Never);

            _appointmentRepositoryMock.Verify(
                r => r.AddAsync(
                    It.IsAny<Appointment>(),
                    It.IsAny<CancellationToken>()),
                Times.Never);
        }

        [Fact]
        public async Task CreateAsync_WhenDoctorDoesNotExist_ThrowsNotFoundException()
        {
            // Arrange
            var patientId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();

            var request = new CreateAppointmentRequest
            {
                PatientId = patientId,
                DoctorId = doctorId,
                StartTime = new DateTime(2026, 10, 10, 10, 0, 0),
                EndTime = new DateTime(2026, 10, 10, 11, 0, 0)
            };

            _createValidatorMock
                .Setup(v => v.ValidateAsync(
                    request,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());

            _patientRepositoryMock
                .Setup(r => r.GetByIdAsync(
                    patientId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new Patient
                {
                    Id = patientId,
                    FirstName = "John",
                    LastName = "Doe"
                });

            _doctorRepositoryMock
                .Setup(r => r.GetByIdAsync(
                    doctorId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync((Doctor?)null);

            // Act
            Func<Task> act = () => _service.CreateAsync(request);

            // Assert
            await act.Should()
                .ThrowAsync<NotFoundException>()
                .WithMessage("Doctor does not exist.");

            _appointmentRepositoryMock.Verify(
                r => r.HasOverlapAsync(
                    It.IsAny<Guid>(),
                    It.IsAny<DateTime>(),
                    It.IsAny<DateTime>(),
                    It.IsAny<Guid?>(),
                    It.IsAny<CancellationToken>()),
                Times.Never);

            _appointmentRepositoryMock.Verify(
                r => r.AddAsync(
                    It.IsAny<Appointment>(),
                    It.IsAny<CancellationToken>()),
                Times.Never);
        }

        [Fact]
        public async Task RescheduleAsync_WhenNewTimeOverlaps_ThrowsConflictException()
        {
            // Arrange
            var appointmentId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();

            var appointment = new Appointment
            {
                Id = appointmentId,
                PatientId = Guid.NewGuid(),
                DoctorId = doctorId,
                StartTime = new DateTime(2026, 10, 10, 10, 0, 0),
                EndTime = new DateTime(2026, 10, 10, 11, 0, 0),
                Status = AppointmentStatus.Scheduled
            };

            var request = new RescheduleAppointmentRequest
            {
                StartTime = new DateTime(2026, 10, 10, 14, 0, 0),
                EndTime = new DateTime(2026, 10, 10, 15, 0, 0)
            };

            _rescheduleValidatorMock
                .Setup(v => v.ValidateAsync(
                    request,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());

            _appointmentRepositoryMock
                .Setup(r => r.GetByIdAsync(
                    appointmentId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(appointment);

            _appointmentRepositoryMock
                .Setup(r => r.HasOverlapAsync(
                    doctorId,
                    request.StartTime,
                    request.EndTime,
                    appointmentId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(true);

            // Act
            Func<Task> act = () =>
                _service.RescheduleAsync(appointmentId, request);

            // Assert
            await act.Should()
                .ThrowAsync<ConflictException>()
                .WithMessage(
                    "The doctor already has an appointment during this time.");

            _appointmentRepositoryMock.Verify(
                r => r.SaveChangesAsync(
                    It.IsAny<CancellationToken>()),
                Times.Never);

            appointment.StartTime.Should()
                .Be(new DateTime(2026, 10, 10, 10, 0, 0));

            appointment.EndTime.Should()
                .Be(new DateTime(2026, 10, 10, 11, 0, 0));
        }

        [Fact]
        public async Task RescheduleAsync_WhenRequestIsValid_UpdatesAppointment()
        {
            // Arrange
            var appointmentId = Guid.NewGuid();
            var doctorId = Guid.NewGuid();

            var appointment = new Appointment
            {
                Id = appointmentId,
                PatientId = Guid.NewGuid(),
                DoctorId = doctorId,
                StartTime = new DateTime(2026, 10, 10, 10, 0, 0),
                EndTime = new DateTime(2026, 10, 10, 11, 0, 0),
                Status = AppointmentStatus.Scheduled
            };

            var request = new RescheduleAppointmentRequest
            {
                StartTime = new DateTime(2026, 10, 10, 14, 0, 0),
                EndTime = new DateTime(2026, 10, 10, 15, 0, 0)
            };

            _rescheduleValidatorMock
                .Setup(v => v.ValidateAsync(
                    request,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());

            _appointmentRepositoryMock
                .Setup(r => r.GetByIdAsync(
                    appointmentId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(appointment);

            _appointmentRepositoryMock
                .Setup(r => r.HasOverlapAsync(
                    doctorId,
                    request.StartTime,
                    request.EndTime,
                    appointmentId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(false);

            // Act
            var result = await _service.RescheduleAsync(
                appointmentId,
                request);

            // Assert
            result.Should().BeTrue();

            appointment.StartTime.Should().Be(request.StartTime);
            appointment.EndTime.Should().Be(request.EndTime);

            _appointmentRepositoryMock.Verify(
                r => r.SaveChangesAsync(
                    It.IsAny<CancellationToken>()),
                Times.Once);
        }

        [Fact]
        public async Task RescheduleAsync_WhenAppointmentDoesNotExist_ReturnsFalse()
        {
            // Arrange
            var appointmentId = Guid.NewGuid();

            var request = new RescheduleAppointmentRequest
            {
                StartTime = new DateTime(2026, 10, 10, 14, 0, 0),
                EndTime = new DateTime(2026, 10, 10, 15, 0, 0)
            };

            _rescheduleValidatorMock
                .Setup(v => v.ValidateAsync(
                    request,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync(new FluentValidation.Results.ValidationResult());

            _appointmentRepositoryMock
                .Setup(r => r.GetByIdAsync(
                    appointmentId,
                    It.IsAny<CancellationToken>()))
                .ReturnsAsync((Appointment?)null);

            // Act
            var result = await _service.RescheduleAsync(
                appointmentId,
                request);

            // Assert
            result.Should().BeFalse();

            _appointmentRepositoryMock.Verify(
                r => r.HasOverlapAsync(
                    It.IsAny<Guid>(),
                    It.IsAny<DateTime>(),
                    It.IsAny<DateTime>(),
                    It.IsAny<Guid?>(),
                    It.IsAny<CancellationToken>()),
                Times.Never);

            _appointmentRepositoryMock.Verify(
                r => r.SaveChangesAsync(
                    It.IsAny<CancellationToken>()),
                Times.Never);
        }

    }
}
