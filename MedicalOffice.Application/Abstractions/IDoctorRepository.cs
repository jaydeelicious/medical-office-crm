using MedicalOffice.Domain.Entities;

namespace MedicalOffice.Application.Abstractions
{
    public interface IDoctorRepository
    {
        Task<Doctor?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default);

        Task<IReadOnlyList<Doctor>> GetAllAsync(
            CancellationToken cancellationToken = default);

        Task AddAsync(
            Doctor doctor,
            CancellationToken cancellationToken = default);

        void Remove(Doctor doctor);

        Task SaveChangesAsync(
            CancellationToken cancellationToken = default);
    }
}
