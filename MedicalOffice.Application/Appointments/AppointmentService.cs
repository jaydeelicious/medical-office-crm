using MedicalOffice.Application.Abstractions;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Domain.Enums;
using MedicalOffice.Application.Exceptions;
using FluentValidation;

namespace MedicalOffice.Application.Appointments
{
    public class AppointmentService
    {
        private readonly IAppointmentRepository _appointmentRepository;
        private readonly IDoctorRepository _doctorRepository;
        private readonly IPatientRepository _patientRepository;
        private readonly IValidator<CreateAppointmentRequest> _createValidator;
        private readonly IValidator<RescheduleAppointmentRequest> _rescheduleValidator;
        private readonly IValidator<UpdateAppointmentStatusRequest> _statusValidator;

        public AppointmentService(
            IAppointmentRepository appointmentRepository,
            IDoctorRepository doctorRepository,
            IPatientRepository patientRepository,
            IValidator<CreateAppointmentRequest> createValidator,
            IValidator<RescheduleAppointmentRequest> rescheduleValidator,
            IValidator<UpdateAppointmentStatusRequest> statusValidator)
        {
            _appointmentRepository = appointmentRepository;
            _doctorRepository = doctorRepository;
            _patientRepository = patientRepository;
            _createValidator = createValidator;
            _rescheduleValidator = rescheduleValidator;
            _statusValidator = statusValidator;
        }

        public async Task<IReadOnlyList<AppointmentDto>> GetAllAsync(
            Guid? doctorId = null,
            DateOnly? date = null,
            CancellationToken cancellationToken = default)
        {
            var appointments =
                await _appointmentRepository.GetAllAsync(
                    doctorId,
                    date,
                    cancellationToken);

            return appointments
                .Select(MapToDto)
                .ToList();
        }

        public async Task<AppointmentDto?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            var appointment =
                await _appointmentRepository.GetByIdAsync(
                    id,
                    cancellationToken);

            return appointment is null
                ? null
                : MapToDto(appointment);
        }

        public async Task<AppointmentDto> CreateAsync(
            CreateAppointmentRequest request,
            CancellationToken cancellationToken = default)
        {
            await _createValidator.ValidateAndThrowAsync(
                request,
                cancellationToken);

            var patient =
                await _patientRepository.GetByIdAsync(
                    request.PatientId,
                    cancellationToken);

            if (patient is null)
            {
                throw new NotFoundException("Patient does not exist.");
            }

            var doctor = await _doctorRepository.GetByIdAsync(
                request.DoctorId,
                cancellationToken);

            if (doctor is null)
            {
                throw new NotFoundException("Doctor does not exist.");
            }

            return await _appointmentRepository.ExecuteWithDoctorLockAsync(
                request.DoctorId,
                async () =>
                {
                    var hasOverlap =
                        await _appointmentRepository.HasOverlapAsync(
                            request.DoctorId,
                            request.StartTime,
                            request.EndTime,
                            cancellationToken: cancellationToken);

                    if (hasOverlap)
                    {
                        throw new ConflictException(
                            "The doctor already has an appointment during this time.");
                    }

                    var appointment = new Appointment
                    {
                        Id = Guid.NewGuid(),
                        PatientId = request.PatientId,
                        DoctorId = request.DoctorId,
                        StartTime = request.StartTime,
                        EndTime = request.EndTime,
                        Status = AppointmentStatus.Scheduled,
                        Notes = request.Notes
                    };

                    await _appointmentRepository.AddAsync(
                        appointment,
                        cancellationToken);

                    await _appointmentRepository.SaveChangesAsync(
                        cancellationToken);

                    return MapToDto(appointment);
                },
                cancellationToken);
        }

        public async Task<bool> RescheduleAsync(
            Guid id,
            RescheduleAppointmentRequest request,
            CancellationToken cancellationToken = default)
        {
            await _rescheduleValidator.ValidateAndThrowAsync(
                request,
                cancellationToken);

            var expectedVersion = AppointmentConcurrency.DecodeRowVersion(request.RowVersion);

            var appointment = await _appointmentRepository.GetByIdAsync(
                id,
                cancellationToken);

            if (appointment is null)
            {
                return false;
            }

            return await _appointmentRepository.ExecuteWithDoctorLockAsync(
                appointment.DoctorId,
                async () =>
                {
                    // Reload inside the protected transaction.
                    if (!await _appointmentRepository.ReloadAsync(
                        appointment,
                        cancellationToken))
                    {
                        return false;
                    }

                    AppointmentConcurrency.EnsureMatches(
                        appointment.RowVersion,
                        expectedVersion);

                    var currentAppointment = appointment;

                    var hasOverlap = 
                        await _appointmentRepository.HasOverlapAsync(
                            currentAppointment.DoctorId,
                            request.StartTime,
                            request.EndTime,
                            excludeAppointmentId: appointment.Id,
                            cancellationToken: cancellationToken);

                    if (hasOverlap)
                    {
                        throw new ConflictException(
                            "The doctor already has an appointment during this time.");
                    }

                    currentAppointment.StartTime = request.StartTime;
                    currentAppointment.EndTime = request.EndTime;

                    await _appointmentRepository.SaveChangesAsync(
                        cancellationToken);

                    return true;
                },
                cancellationToken);
        }

        public async Task<bool> UpdateStatusAsync(
            Guid id,
            UpdateAppointmentStatusRequest request,
            CancellationToken cancellationToken = default)
        {
            await _statusValidator.ValidateAndThrowAsync(
                request,
                cancellationToken);

            var expectedVersion = AppointmentConcurrency.DecodeRowVersion(request.RowVersion);

            var appointment =
                await _appointmentRepository.GetByIdAsync(
                    id,
                    cancellationToken);

            if (appointment is null)
            {
                return false;
            }

            return await _appointmentRepository.ExecuteWithDoctorLockAsync(
                appointment.DoctorId,
                async () =>
                {
                    if (!await _appointmentRepository.ReloadAsync(
                        appointment,
                        cancellationToken))
                    {
                        return false;
                    }

                    AppointmentConcurrency.EnsureMatches(
                        appointment.RowVersion,
                        expectedVersion);

                    var isReactivation =
                        appointment.Status == AppointmentStatus.Cancelled &&
                        request.Status != AppointmentStatus.Cancelled;

                    if (isReactivation)
                    {
                        var hasOverlap =
                            await _appointmentRepository.HasOverlapAsync(
                                appointment.DoctorId,
                                appointment.StartTime,
                                appointment.EndTime,
                                excludeAppointmentId: appointment.Id,
                                cancellationToken: cancellationToken);

                        if (hasOverlap)
                        {
                            throw new ConflictException("The doctor already has an appointment during this time.");
                        }
                    }

                    appointment.Status = request.Status;

                    await _appointmentRepository.SaveChangesAsync(cancellationToken);

                    return true;
                },
                cancellationToken);
        }

        public async Task<bool> DeleteAsync(
            Guid id,
            string rowVersion,
            CancellationToken cancellationToken = default)
        {
            var expectedVersion =
                AppointmentConcurrency.DecodeRowVersion(rowVersion);

            var appointment =
                await _appointmentRepository.GetByIdAsync(
                    id,
                    cancellationToken);

            if (appointment is null)
            {
                return false;
            }

            return await _appointmentRepository.ExecuteWithDoctorLockAsync(
                appointment.DoctorId,
                async () =>
                {
                    if (!await _appointmentRepository.ReloadAsync(
                        appointment,
                        cancellationToken))
                    {
                        return false;
                    }

                    AppointmentConcurrency.EnsureMatches(
                        appointment.RowVersion,
                        expectedVersion);

                    _appointmentRepository.Remove(appointment);

                    await _appointmentRepository.SaveChangesAsync(cancellationToken);

                    return true;
                },
                cancellationToken);
        }

        private static AppointmentDto MapToDto(
            Appointment appointment)
        {
            return new AppointmentDto
            {
                Id = appointment.Id,
                PatientId = appointment.PatientId,
                DoctorId = appointment.DoctorId,
                StartTime = appointment.StartTime,
                EndTime = appointment.EndTime,
                Status = appointment.Status,
                Notes = appointment.Notes,
                RowVersion = Convert.ToBase64String(appointment.RowVersion)
            };
        }
    }
}
