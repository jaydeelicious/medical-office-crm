using System;
using System.Collections.Generic;
using System.Text;
using MedicalOffice.Domain.Entities;

namespace MedicalOffice.Application.Abstractions
{
    public interface IPatientRepository
    {
        Task<Patient?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default);

        Task<IReadOnlyList<Patient>> GetAllAsync(
            CancellationToken cancellationToken = default);

        Task AddAsync(
            Patient patient,
            CancellationToken cancellationToken = default);

        void Remove(Patient patient);

        Task SaveChangesAsync(
            CancellationToken cancellationToken = default);
    }
}
