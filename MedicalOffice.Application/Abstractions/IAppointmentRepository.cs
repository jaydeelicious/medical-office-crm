using MedicalOffice.Domain.Entities;

namespace MedicalOffice.Application.Abstractions
{
    public interface IAppointmentRepository
    {
        Task<Appointment?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default);

        Task<IReadOnlyList<Appointment>> GetAllAsync(
            CancellationToken cancellationToken = default);

        Task AddAsync(
            Appointment appointment,
            CancellationToken cancellationToken = default);

        Task<bool> HasOverlapAsync(
            Guid doctorId,
            DateTime startTime,
            DateTime endTime,
            Guid? excludeAppointmentId = null,
            CancellationToken cancellationToken = default);

        void Remove(Appointment appointment);

        Task SaveChangesAsync(
            CancellationToken cancellationToken = default);
    }
}
