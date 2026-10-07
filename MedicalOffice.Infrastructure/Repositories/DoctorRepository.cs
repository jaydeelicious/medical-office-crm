using MedicalOffice.Application.Abstractions;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MedicalOffice.Infrastructure.Repositories
{
    public class DoctorRepository : IDoctorRepository
    {
        private readonly MedicalOfficeDbContext _context;

        public DoctorRepository(MedicalOfficeDbContext context)
        {
            _context = context;
        }

        public async Task<Doctor?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            return await _context.Doctors
                .FirstOrDefaultAsync(
                d => d.Id == id,
                cancellationToken);
        }

        public async Task<IReadOnlyList<Doctor>> GetAllAsync(
            CancellationToken cancellationToken = default)
        {
            return await _context.Doctors
                .AsNoTracking()
                .ToListAsync(cancellationToken);
        }

        public async Task AddAsync(
            Doctor doctor,
            CancellationToken cancellationToken = default)
        {
            await _context.Doctors.AddAsync(
                doctor,
                cancellationToken);
        }

        public void Remove(Doctor doctor)
        {
            _context.Doctors.Remove(doctor);
        }

        public async Task SaveChangesAsync(
            CancellationToken cancellationToken = default)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}
