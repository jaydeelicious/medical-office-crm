using MedicalOffice.Application.Abstractions;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MedicalOffice.Infrastructure.Repositories
{
    public class PatientRepository : IPatientRepository
    {
        private readonly MedicalOfficeDbContext _context;

        public PatientRepository(MedicalOfficeDbContext context)
        {
            _context = context;
        }

        public async Task<Patient?> GetByIdAsync(
            Guid id, 
            CancellationToken cancellationToken = default)
        {
            return await _context.Patients
                .FirstOrDefaultAsync(
                p => p.Id == id,
                cancellationToken);
        }

        public async Task<IReadOnlyList<Patient>> GetAllAsync(
            CancellationToken cancellationToken = default)
        {
            return await _context.Patients
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }

        public async Task AddAsync(
            Patient patient,
            CancellationToken cancellationToken = default)
        {
            await _context.Patients.AddAsync(
                patient,
                cancellationToken);
        }

        public void Remove(Patient patient)
        {
            _context.Patients.Remove(patient);
        }

        public async Task SaveChangesAsync(
            CancellationToken cancellationToken = default)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}
