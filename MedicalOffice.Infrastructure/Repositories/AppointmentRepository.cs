using System.Data;
using System.Data.Common;
using MedicalOffice.Application.Abstractions;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Domain.Enums;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

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
            Guid? doctorId = null,
            DateOnly? date = null,
            CancellationToken cancellationToken = default)
        {
            IQueryable<Appointment> query = _context.Appointments
                .AsNoTracking();

            if (doctorId.HasValue)
            {
                query = query.Where(a => a.DoctorId == doctorId.Value);
            }

            if (date.HasValue)
            {
                var startOfDay = date.Value.ToDateTime(
                    TimeOnly.MinValue);

                var endOfDay = startOfDay.AddDays(1);

                query = query.Where(a =>
                    a.StartTime >= startOfDay &&
                    a.StartTime < endOfDay);
            }

            return await query
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

        public async Task<T> ExecuteWithDoctorLockAsync<T>(
            Guid doctorId,
            Func<Task<T>> operation,
            CancellationToken cancellationToken = default)
        {
            var strategy = _context.Database.CreateExecutionStrategy();

            return await strategy.ExecuteAsync(async () =>
            {
                await using var transaction =
                    await _context.Database.BeginTransactionAsync(
                        IsolationLevel.ReadCommitted,
                        cancellationToken);

                if (_context.Database.IsSqlServer())
                {
                    await AcquireDoctorLockAsync(
                        doctorId,
                        transaction,
                        cancellationToken);
                }
                else if (_context.Database.ProviderName != "Microsoft.EntityFrameworkCore.Sqlite")
                {
                    throw new NotSupportedException("Scheduling transactions require a supported database provider.");
                }

                var result = await operation();

                await transaction.CommitAsync(cancellationToken);

                return result;
            });
        }

        private async Task AcquireDoctorLockAsync(
            Guid doctorId,
            IDbContextTransaction transaction,
            CancellationToken cancellationToken)
        {
            var connection = _context.Database.GetDbConnection();

            await using var command = connection.CreateCommand();

            command.Transaction = transaction.GetDbTransaction();

            command.CommandText = """
                DECLARE @result int;

                EXEC @result = sp_getapplock
                    @Resource = @resource,
                    @LockMode = 'Exclusive',
                    @LockOwner = 'Transaction',
                    @LockTimeout = 10000;

                SELECT @result;
                """;

            var resourceParameter = command.CreateParameter();
            resourceParameter.ParameterName = "@resource";
            resourceParameter.Value = $"appointment:doctor:{doctorId:N}";

            command.Parameters.Add(resourceParameter);

            var result = await command.ExecuteScalarAsync(cancellationToken);

            var lockResult = Convert.ToInt32(result);

            if (lockResult < 0)
            {
                throw new TimeoutException("Unable to acquire the doctor's scheduling lock.");
            }
        }
    }
}
