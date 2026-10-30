using MedicalOffice.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace MedicalOffice.Tests.Integration;

public sealed class SqliteRowVersionInterceptor : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        SetRowVersions(eventData.Context);
        return result;
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        SetRowVersions(eventData.Context);
        return new ValueTask<InterceptionResult<int>>(result);
    }

    private static void SetRowVersions(DbContext? context)
    {
        if (context is null)
        {
            return;
        }

        foreach (var entry in context.ChangeTracker
            .Entries<Appointment>())
        {
            if (entry.State is EntityState.Added 
                or EntityState.Modified)
            {
                entry.Property(a => a.RowVersion).CurrentValue =
                    System.Security.Cryptography.RandomNumberGenerator.GetBytes(8);
            }
        }
    }
}