
using System.Runtime.CompilerServices;
using MedicalOffice.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace MedicalOffice.Infrastructure.Persistence.Interceptors;

public sealed class AuditSaveChangesInterceptor
    : SaveChangesInterceptor
{
    private readonly ConditionalWeakTable<DbContext, PendingAuditState>
        _contextStates = new();

    private sealed class PendingAuditState
    {
        public Dictionary<object, AuditLog> PendingAudits { get; } =
            new(ReferenceEqualityComparer.Instance);
    }

    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        ReconcileAuditEvents(eventData.Context);

        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        ReconcileAuditEvents(eventData.Context);

        return new ValueTask<InterceptionResult<int>>(result);
    }

    public override int SavedChanges(
        SaveChangesCompletedEventData eventData,
        int result)
    {
        ClearPendingAudits(eventData.Context);

        return base.SavedChanges(eventData, result);
    }

    public override ValueTask<int> SavedChangesAsync(
        SaveChangesCompletedEventData eventData,
        int result,
        CancellationToken cancellationToken = default)
    {
        ClearPendingAudits(eventData.Context);

        return base.SavedChangesAsync(
            eventData, result, cancellationToken);
    }

    private void ReconcileAuditEvents(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        context.ChangeTracker.DetectChanges();

        var state = _contextStates.GetValue(
            context, _ => new PendingAuditState());

        var activeEntries = context.ChangeTracker.Entries()
            .Where(entry =>
                entry.Entity is Patient or Doctor or Appointment &&
                entry.State is EntityState.Added
                    or EntityState.Modified
                    or EntityState.Deleted)
            .ToList();

        var activeEntities = new HashSet<object>(
            activeEntries.Select(e => e.Entity),
            ReferenceEqualityComparer.Instance);

        // Remove pending audit events for abandoned operations.
        foreach (var (entity, auditLog) in
            state.PendingAudits.ToList())
        {
            if (activeEntities.Contains(entity))
            {
                continue;
            }

            var auditEntry = context.Entry(auditLog);

            if (auditEntry.State == EntityState.Added)
            {
                auditEntry.State = EntityState.Detached;
            }

            state.PendingAudits.Remove(entity);
        }

        foreach (var entry in activeEntries)
        {
            var action = GetAction(entry.State);

            if (state.PendingAudits.TryGetValue(
                entry.Entity, out var existingAudit))
            {
                // Reconcile changes after a failed save.
                existingAudit.Action = action;
                existingAudit.EntityType =
                    entry.Metadata.ClrType.Name;
                existingAudit.EntityId = GetEntityId(entry);

                continue;
            }

            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                OccurredAtUtc = DateTime.UtcNow,
                EntityType = entry.Metadata.ClrType.Name,
                EntityId = GetEntityId(entry),
                Action = action,
                UserId = null,
                ChangesJson = null,
                CorrelationId = null
            };

            context.Set<AuditLog>().Add(auditLog);

            state.PendingAudits.Add(entry.Entity, auditLog);
        }
    }

    private void ClearPendingAudits(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        _contextStates.Remove(context);
    }

    private static Guid GetEntityId(EntityEntry entry)
    {
        return entry.Entity switch
        {
            Patient patient => patient.Id,
            Doctor doctor => doctor.Id,
            Appointment appointment => appointment.Id,
            _ => throw new InvalidOperationException(
                "Unsupported auditable entity.")
        };
    }

    private static string GetAction(EntityState state)
    {
        return state switch
        {
            EntityState.Added => "Created",
            EntityState.Modified => "Updated",
            EntityState.Deleted => "Deleted",
            _ => throw new InvalidOperationException(
                "Unsupported entity state.")
        };
    }
}
