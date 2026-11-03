using MedicalOffice.Application.Abstractions;
using MedicalOffice.Application.AuditLogs;
using MedicalOffice.Application.Common;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Formats.Asn1;

namespace MedicalOffice.Infrastructure.Repositories;

public sealed class AuditLogRepository : IAuditLogRepository
{
    private readonly MedicalOfficeDbContext _context;

    public AuditLogRepository(MedicalOfficeDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<AuditLog>> GetPagedAsync(
        AuditLogQuery query,
        CancellationToken cancellationToken = default)
    {
        IQueryable<AuditLog> auditLogs = _context.AuditLogs.AsNoTracking();

        // Entity type filtering
        if (!string.IsNullOrWhiteSpace(query.EntityType))
        {
            auditLogs = auditLogs.Where(a => a.EntityType == query.EntityType);
        }

        // Entity ID filtering
        if (query.EntityId.HasValue)
        {
            auditLogs = auditLogs.Where(a => a.EntityId == query.EntityId.Value);
        }

        // Action filtering
        if (!string.IsNullOrWhiteSpace(query.Action))
        {
            auditLogs = auditLogs.Where(a => a.Action == query.Action);
        }

        // User filtering
        if (!string.IsNullOrWhiteSpace(query.UserId))
        {
            auditLogs = auditLogs.Where(a => a.UserId == query.UserId);
        }

        // UTC date filtering
        if (query.FromUtc.HasValue)
        {
            auditLogs = auditLogs.Where(a => a.OccurredAtUtc >= query.FromUtc.Value);
        }

        if (query.ToUtc.HasValue)
        {
            auditLogs = auditLogs.Where(a =>
                a.OccurredAtUtc <= query.ToUtc.Value);
        }

        // Count after filtering, before pagination.
        var totalCount = await auditLogs.CountAsync(
            cancellationToken);

        // Deterministic ordering and pagination.
        var items = await auditLogs
            .OrderByDescending(a => a.OccurredAtUtc)
            .ThenByDescending(a => a.Id)
            .Skip(checked((query.Page - 1) * query.PageSize))
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResult<AuditLog>
        {
            Items = items,
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = totalCount
        };
    }

    public async Task<AuditLog?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        return await _context.AuditLogs
            .AsNoTracking()
            .FirstOrDefaultAsync(a => a.Id == id, cancellationToken);
    }
}