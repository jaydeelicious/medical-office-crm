using FluentValidation;
using MedicalOffice.Application.Abstractions;
using MedicalOffice.Domain.Entities;

namespace MedicalOffice.Application.Patients
{
    public class PatientService
    {
        private readonly IPatientRepository _patientRepository;
        private readonly IValidator<CreatePatientRequest> _createValidator;
        private readonly IValidator<UpdatePatientRequest> _updateValidator;

        public PatientService(
            IPatientRepository patientRepository,
            IValidator<CreatePatientRequest> createValidator,
            IValidator<UpdatePatientRequest> updateValidator)
        {
            _patientRepository = patientRepository;
            _createValidator = createValidator;
            _updateValidator = updateValidator;
        }

        public async Task<IReadOnlyList<PatientDto>> GetAllAsync(
            CancellationToken cancellationToken = default)
        {
            var patients = await _patientRepository.GetAllAsync(cancellationToken);

            return patients
                .Select(MapToDto)
                .ToList();
        }

        public async Task<PatientDto?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            var patient = await _patientRepository.GetByIdAsync(
                id,
                cancellationToken);

            return patient is null
                ? null
                : MapToDto(patient);
        }

        public async Task<PatientDto> CreateAsync(
            CreatePatientRequest request,
            CancellationToken cancellationToken = default)
        {
            await _createValidator.ValidateAndThrowAsync(
                request,
                cancellationToken);

            var patient = new Patient
            {
                Id = Guid.NewGuid(),
                FirstName = request.FirstName,
                LastName = request.LastName,
                Phone = request.Phone,
                Email = request.Email,
                DateOfBirth = request.DateOfBirth
            };

            await _patientRepository.AddAsync(
                patient,
                cancellationToken);

            await _patientRepository.SaveChangesAsync(cancellationToken);

            return MapToDto(patient);
        }

        public async Task<bool> UpdateAsync(
            Guid id, 
            UpdatePatientRequest request, 
            CancellationToken cancellationToken = default)
        {
            await _updateValidator.ValidateAndThrowAsync(
                request,
                cancellationToken);

            var patient = await _patientRepository.GetByIdAsync(
                id,
                cancellationToken);

            if (patient is null)
            {
                return false;
            }

            patient.FirstName = request.FirstName;
            patient.LastName = request.LastName;
            patient.Phone = request.Phone;
            patient.Email = request.Email;
            patient.DateOfBirth = request.DateOfBirth;

            await _patientRepository.SaveChangesAsync(cancellationToken);

            return true;
        }

        public async Task<bool> DeleteAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            var patient = await _patientRepository.GetByIdAsync(
                id,
                cancellationToken);

            if (patient is null)
            {
                return false;
            }

            _patientRepository.Remove(patient);

            await _patientRepository.SaveChangesAsync(cancellationToken);

            return true;
        }

        private static PatientDto MapToDto(Patient patient)
        {
            return new PatientDto
            {
                Id = patient.Id,
                FirstName = patient.FirstName,
                LastName = patient.LastName,
                Phone = patient.Phone,
                Email = patient.Email,
                DateOfBirth = patient.DateOfBirth
            };
        }
    }
}
