using MedicalOffice.Application.AuditLogs;
using MedicalOffice.Application.Common;
using MedicalOffice.Domain.Entities;

namespace MedicalOffice.Application.Abstractions;

public interface IAuditLogRepository
{
    Task<PagedResult<AuditLog>> GetPagedAsync(
        AuditLogQuery query,
        CancellationToken cancellationToken = default);

    Task<AuditLog?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default);
}