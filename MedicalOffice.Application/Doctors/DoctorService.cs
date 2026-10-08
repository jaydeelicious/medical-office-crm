using FluentValidation;
using MedicalOffice.Application.Abstractions;
using MedicalOffice.Application.Patients;
using MedicalOffice.Domain.Entities;

namespace MedicalOffice.Application.Doctors
{
    public class DoctorService
    {
        private readonly IDoctorRepository _doctorRepository;
        private readonly IValidator<CreateDoctorRequest> _createValidator;
        private readonly IValidator<UpdateDoctorRequest> _updateValidator;

        public DoctorService(
            IDoctorRepository doctorRepository,
            IValidator<CreateDoctorRequest> createValidator,
            IValidator<UpdateDoctorRequest> updateValidator)
        {
            _doctorRepository = doctorRepository;
            _createValidator = createValidator;
            _updateValidator = updateValidator;
        }

        public async Task<IReadOnlyList<DoctorDto>> GetAllAsync(
            CancellationToken cancellationToken = default)
        {
            var doctors = await _doctorRepository.GetAllAsync(cancellationToken);

            return doctors
                .Select(MapToDto)
                .ToList();
        }

        public async Task<DoctorDto?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            var doctor = await _doctorRepository.GetByIdAsync(
                id,
                cancellationToken);

            return doctor is null
                ? null
                : MapToDto(doctor);
        }

        public async Task<DoctorDto> CreateAsync(
            CreateDoctorRequest request,
            CancellationToken cancellationToken = default)
        {
            await _createValidator.ValidateAndThrowAsync(
                request,
                cancellationToken);

            var doctor = new Doctor
            {
                Id = Guid.NewGuid(),
                FirstName = request.FirstName,
                LastName = request.LastName,
                Phone = request.Phone,
                Email = request.Email,
                Specialty = request.Specialty
            };

            await _doctorRepository.AddAsync(
                doctor,
                cancellationToken);

            await _doctorRepository.SaveChangesAsync(cancellationToken);

            return MapToDto(doctor);
        }

        public async Task<bool> UpdateAsync(
            Guid id,
            UpdateDoctorRequest request,
            CancellationToken cancellationToken = default)
        {
            await _updateValidator.ValidateAndThrowAsync(
                request,
                cancellationToken);

            var doctor = await _doctorRepository.GetByIdAsync(
                id,
                cancellationToken);

            if (doctor is null)
            {
                return false;
            }

            doctor.FirstName = request.FirstName;
            doctor.LastName = request.LastName;
            doctor.Phone = request.Phone;
            doctor.Email = request.Email;
            doctor.Specialty = request.Specialty;

            await _doctorRepository.SaveChangesAsync(cancellationToken);

            return true;
        }

        public async Task<bool> DeleteAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            var doctor = await _doctorRepository.GetByIdAsync(
                id,
                cancellationToken);

            if (doctor is null)
            {
                return false;
            }

            _doctorRepository.Remove(doctor);

            await _doctorRepository.SaveChangesAsync(cancellationToken);

            return true;
        }

        private static DoctorDto MapToDto(Doctor doctor)
        {
            return new DoctorDto
            {
                Id = doctor.Id,
                FirstName = doctor.FirstName,
                LastName = doctor.LastName,
                Phone = doctor.Phone,
                Email = doctor.Email,
                Specialty = doctor.Specialty
            };
        }

    }
}
