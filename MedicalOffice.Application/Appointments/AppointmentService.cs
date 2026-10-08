using MedicalOffice.Application.Abstractions;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Domain.Enums;
using MedicalOffice.Application.Exceptions;

namespace MedicalOffice.Application.Appointments
{
    public class AppointmentService
    {
        private readonly IAppointmentRepository _appointmentRepository;
        private readonly IDoctorRepository _doctorRepository;
        private readonly IPatientRepository _patientRepository;

        public AppointmentService(
            IAppointmentRepository appointmentRepository,
            IDoctorRepository doctorRepository,
            IPatientRepository patientRepository)
        {
            _appointmentRepository = appointmentRepository;
            _doctorRepository = doctorRepository;
            _patientRepository = patientRepository;
        }

        public async Task<IReadOnlyList<AppointmentDto>> GetAllAsync(
            CancellationToken cancellationToken = default)
        {
            var appointments =
                await _appointmentRepository.GetAllAsync(cancellationToken);

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
            if (request.StartTime >= request.EndTime)
            {
                throw new ValidationException(
                    "Start time must be earlier than end time.");
            }

            var patient =
                await _patientRepository.GetByIdAsync(
                    request.PatientId,
                    cancellationToken);

            if (patient is null)
            {
                throw new NotFoundException("Patient does not exist.");
            }

            var doctor =
                await _doctorRepository.GetByIdAsync(
                    request.DoctorId,
                    cancellationToken);

            if (doctor is null)
            {
                throw new NotFoundException("Doctor does not exist.");
            }

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
        }

        public async Task<bool> RescheduleAsync(
            Guid id,
            RescheduleAppointmentRequest request,
            CancellationToken cancellationToken = default)
        {
            if (request.StartTime >= request.EndTime)
            {
                throw new ArgumentException(
                    "Start time must be earlier than end time.");
            }

            var appointment =
                await _appointmentRepository.GetByIdAsync(
                    id,
                    cancellationToken);

            if (appointment is null)
            {
                return false;
            }

            var hasOverlap = 
                await _appointmentRepository.HasOverlapAsync(
                    appointment.DoctorId,
                    request.StartTime,
                    request.EndTime,
                    excludeAppointmentId: appointment.Id,
                    cancellationToken: cancellationToken);

            if (hasOverlap)
            {
                throw new InvalidOperationException(
                    "The doctor already has an appointment during this time.");
            }

            appointment.StartTime = request.StartTime;
            appointment.EndTime = request.EndTime;

            await _appointmentRepository.SaveChangesAsync(
                cancellationToken);

            return true;
        }

        public async Task<bool> UpdateStatusAsync(
            Guid id,
            UpdateAppointmentStatusRequest request,
            CancellationToken cancellationToken = default)
        {
            var appointment =
                await _appointmentRepository.GetByIdAsync(
                    id,
                    cancellationToken);

            if (appointment is null)
            {
                return false;
            }

            appointment.Status = request.Status;

            await _appointmentRepository.SaveChangesAsync(
                cancellationToken);

            return true;
        }

        public async Task<bool> DeleteAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            var appointment =
                await _appointmentRepository.GetByIdAsync(
                    id,
                    cancellationToken);

            if (appointment is null)
            {
                return false;
            }

            _appointmentRepository.Remove(appointment);

            await _appointmentRepository.SaveChangesAsync(
                cancellationToken);

            return true;
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
                Notes = appointment.Notes
            };
        }
    }
}
