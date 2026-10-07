using MedicalOffice.Application.Abstractions;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Domain.Enums;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace MedicalOffice.Infrastructure.Repositories
{
    public class AppointmentRepository : IAppointmentRepository
    {
        private readonly MedicalOfficeDbContext _context;

        public AppointmentRepository(MedicalOfficeDbContext context)
        {
            _context = context;
        }

        public async Task<Appointment?> GetByIdAsync(
            Guid id,
            CancellationToken cancellationToken = default)
        {
            return await _context.Appointments
                .FirstOrDefaultAsync(
                    a => a.Id == id,
                    cancellationToken);
        }

        public async Task<IReadOnlyList<Appointment>> GetAllAsync(
            CancellationToken cancellationToken = default)
        {
            return await _context.Appointments
                .AsNoTracking()
                .OrderBy(a => a.StartTime)
                .ToListAsync(cancellationToken);
        }

        public async Task AddAsync(
            Appointment appointment,
            CancellationToken cancellationToken = default)
        {
            await _context.Appointments.AddAsync(
                appointment,
                cancellationToken);
        }

        public async Task<bool> HasOverlapAsync(
            Guid doctorId,
            DateTime startTime,
            DateTime endTime,
            Guid? excludeAppointmentId = null,
            CancellationToken cancellationToken = default)
        {
            return await _context.Appointments.AnyAsync(
                a =>
                    a.DoctorId == doctorId &&
                    a.Status != AppointmentStatus.Cancelled &&
                    (!excludeAppointmentId.HasValue ||
                     a.Id != excludeAppointmentId.Value) &&
                    a.StartTime < endTime &&
                    a.EndTime > startTime,
                cancellationToken);
        }

        public void Remove(Appointment appointment)
        {
            _context.Appointments.Remove(appointment);
        }

        public async Task SaveChangesAsync(
            CancellationToken cancellationToken = default)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }
    }
}
