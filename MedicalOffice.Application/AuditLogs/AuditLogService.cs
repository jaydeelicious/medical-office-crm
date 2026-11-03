using MedicalOffice.Application.Abstractions;
using MedicalOffice.Application.Common;
using MedicalOffice.Domain.Entities;

namespace MedicalOffice.Application.AuditLogs;

public sealed class AuditLogService
{
    private readonly IAuditLogRepository _repository;

    public AuditLogService(IAuditLogRepository repository)
    {
        _repository = repository;
    }

    public async Task<PagedResult<AuditLogDto>> GetPagedAsync(
        AuditLogQuery query,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(query);

        ValidateQuery(query);

        var normalizedQuery = new AuditLogQuery
        {
            EntityType = NormalizeEntityType(query.EntityType),
            EntityId = query.EntityId,
            Action = NormalizeAction(query.Action),
            UserId = string.IsNullOrWhiteSpace(query.UserId)
                ? null
                : query.UserId.Trim(),
            FromUtc = query.FromUtc,
            ToUtc = query.ToUtc,
            Page = query.Page,
            PageSize = query.PageSize
        };

        var result = await _repository.GetPagedAsync(
            normalizedQuery,
            cancellationToken);

        return new PagedResult<AuditLogDto>
        {
            Items = result.Items.Select(MapToDto).ToList(),
            Page = result.Page,
            PageSize = result.PageSize,
            TotalCount = result.TotalCount
        };
    }

    public async Task<AuditLogDto?> GetByIdAsync(
        Guid id,
        CancellationToken cancellationToken = default)
    {
        if (id == Guid.Empty)
        {
            throw new ArgumentException(
                "Audit log ID cannot be empty.",
                nameof(id));
        }

        var auditLog = await _repository.GetByIdAsync(
            id,
            cancellationToken);

        return auditLog is null
            ? null
            : MapToDto(auditLog);
    }

    private static void ValidateQuery(AuditLogQuery query)
    {
        if (query.Page < 1)
        {
            throw new ArgumentException("Page must be greater than or equal to 1.");
        }

        if (query.PageSize is < 1 or > 100)
        {
            throw new ArgumentException("Page size must be between 1 and 100.");
        }

        if (query.EntityId == Guid.Empty)
        {
            throw new ArgumentException("Entity ID cannot be empty.");
        }

        if (query.FromUtc.HasValue && query.FromUtc.Value.Kind != DateTimeKind.Utc)
        {
            throw new ArgumentException("FromUtc must be a UTC timestamp.");
        }

        if (query.ToUtc.HasValue && query.ToUtc.Value.Kind != DateTimeKind.Utc)
        {
            throw new ArgumentException("ToUtc must be a UTC timestamp.");
        }

        if (query.FromUtc.HasValue &&
            query.ToUtc.HasValue &&
            query.FromUtc.Value > query.ToUtc.Value)
        {
            throw new ArgumentException(
                "FromUtc cannot be later than ToUtc.");
        }

        // Validate optional filters.
        NormalizeEntityType(query.EntityType);
        NormalizeAction(query.Action);
    }

    private static string? NormalizeEntityType(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return value.Trim().ToLowerInvariant() switch
        {
            "patient" => "Patient",
            "doctor" => "Doctor",
            "appointment" => "Appointment",
            _ => throw new ArgumentException(
                "Unsupported audit entity type.")
        };
    }

    private static string? NormalizeAction(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        return value.Trim().ToLowerInvariant() switch
        {
            "created" => "Created",
            "updated" => "Updated",
            "deleted" => "Deleted",
            _ => throw new ArgumentException(
                "Unsupported audit action.")
        };
    }

    private static AuditLogDto MapToDto(AuditLog log)
    {
        return new AuditLogDto
        {
            Id = log.Id,
            OccurredAtUtc = DateTime.SpecifyKind(
                log.OccurredAtUtc,
                DateTimeKind.Utc),
            EntityType = log.EntityType,
            EntityId = log.EntityId,
            Action = log.Action,
            UserId = log.UserId
        };
    }
}