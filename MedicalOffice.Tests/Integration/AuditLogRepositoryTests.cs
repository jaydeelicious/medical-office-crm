
using FluentAssertions;
using MedicalOffice.Application.Abstractions;
using MedicalOffice.Application.AuditLogs;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MedicalOffice.Tests.Integration;

public class AuditLogRepositoryTests
{
    [Fact]
    public async Task GetPagedAsync_ShouldFilterByEntityTypeAndId()
    {
        using var factory = new CustomWebApplicationFactory();
        await SeedAuditLogsAsync(factory);

        using var scope = factory.Services.CreateScope();

        var repository = scope.ServiceProvider
            .GetRequiredService<IAuditLogRepository>();

        var patientId = TestPatientId;

        var result = await repository.GetPagedAsync(new AuditLogQuery
        {
            EntityType = "Patient",
            EntityId = patientId
        });

        result.TotalCount.Should().Be(3);
        result.Items.Should().HaveCount(3);

        result.Items.Should().OnlyContain(a =>
            a.EntityType == "Patient" &&
            a.EntityId == patientId);
    }

    [Fact]
    public async Task GetPagedAsync_ShouldFilterByActionAndUser()
    {
        using var factory = new CustomWebApplicationFactory();
        await SeedAuditLogsAsync(factory);

        using var scope = factory.Services.CreateScope();

        var repository = scope.ServiceProvider
            .GetRequiredService<IAuditLogRepository>();

        var result = await repository.GetPagedAsync(new AuditLogQuery
        {
            Action = "Updated",
            UserId = "user-1"
        });

        result.TotalCount.Should().Be(1);
        result.Items.Should().ContainSingle();

        result.Items[0].Action.Should().Be("Updated");
        result.Items[0].UserId.Should().Be("user-1");
    }

    [Fact]
    public async Task GetPagedAsync_ShouldFilterByInclusiveDateRange()
    {
        using var factory = new CustomWebApplicationFactory();
        await SeedAuditLogsAsync(factory);

        using var scope = factory.Services.CreateScope();

        var repository = scope.ServiceProvider
            .GetRequiredService<IAuditLogRepository>();

        var result = await repository.GetPagedAsync(new AuditLogQuery
        {
            FromUtc = Utc(2026, 11, 2, 10),
            ToUtc = Utc(2026, 11, 3, 10)
        });

        result.TotalCount.Should().Be(3);
        result.Items.Should().HaveCount(3);

        result.Items.Should().OnlyContain(a =>
            a.OccurredAtUtc >= Utc(2026, 11, 2, 10) &&
            a.OccurredAtUtc <= Utc(2026, 11, 3, 10));
    }

    [Fact]
    public async Task GetPagedAsync_ShouldPaginateNewestFirst()
    {
        using var factory = new CustomWebApplicationFactory();
        await SeedAuditLogsAsync(factory);

        using var scope = factory.Services.CreateScope();

        var repository = scope.ServiceProvider
            .GetRequiredService<IAuditLogRepository>();

        var firstPage = await repository.GetPagedAsync(
            new AuditLogQuery
            {
                Page = 1,
                PageSize = 2
            });

        var secondPage = await repository.GetPagedAsync(
            new AuditLogQuery
            {
                Page = 2,
                PageSize = 2
            });

        firstPage.TotalCount.Should().Be(5);
        secondPage.TotalCount.Should().Be(5);

        firstPage.Items.Should().HaveCount(2);
        secondPage.Items.Should().HaveCount(2);

        firstPage.Items[0].OccurredAtUtc.Should()
            .Be(Utc(2026, 11, 4, 10));

        firstPage.Items[1].OccurredAtUtc.Should()
            .Be(Utc(2026, 11, 3, 10));

        firstPage.Items.Select(a => a.Id)
            .Should().NotIntersectWith(
                secondPage.Items.Select(a => a.Id));
    }

    [Fact]
    public async Task GetByIdAsync_ShouldReturnExistingRecordOrNull()
    {
        using var factory = new CustomWebApplicationFactory();
        await SeedAuditLogsAsync(factory);

        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var repository = scope.ServiceProvider
            .GetRequiredService<IAuditLogRepository>();

        var existingId = await context.AuditLogs
            .AsNoTracking()
            .Select(a => a.Id)
            .FirstAsync();

        var existing = await repository.GetByIdAsync(existingId);
        var missing = await repository.GetByIdAsync(Guid.NewGuid());

        existing.Should().NotBeNull();
        existing!.Id.Should().Be(existingId);

        missing.Should().BeNull();
    }

    [Fact]
    public async Task GetPagedAsync_ShouldNotTrackAuditEntities()
    {
        using var factory = new CustomWebApplicationFactory();
        await SeedAuditLogsAsync(factory);

        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var repository = scope.ServiceProvider
            .GetRequiredService<IAuditLogRepository>();

        context.ChangeTracker.Clear();

        await repository.GetPagedAsync(new AuditLogQuery());

        context.ChangeTracker.Entries<AuditLog>()
            .Should().BeEmpty();
    }

    private static readonly Guid TestPatientId =
        Guid.Parse("11111111-1111-1111-1111-111111111111");

    private static DateTime Utc(
        int year, int month, int day, int hour) =>
        new(year, month, day, hour, 0, 0, DateTimeKind.Utc);

    private static async Task SeedAuditLogsAsync(
        CustomWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();

        var context = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await context.Database.EnsureCreatedAsync();

        var otherPatientId = Guid.NewGuid();
        var doctorId = Guid.NewGuid();

        context.AuditLogs.AddRange(
            MakeLog("Patient", TestPatientId,
                "Created", "user-1", Utc(2026, 11, 1, 10)),

            MakeLog("Patient", TestPatientId,
                "Updated", "user-1", Utc(2026, 11, 2, 10)),

            MakeLog("Patient", TestPatientId,
                "Deleted", "user-2", Utc(2026, 11, 3, 10)),

            MakeLog("Patient", otherPatientId,
                "Created", "user-2", Utc(2026, 11, 4, 10)),

            MakeLog("Doctor", doctorId,
                "Updated", "user-2", Utc(2026, 11, 2, 10))
        );

        await context.SaveChangesAsync();
    }

    private static AuditLog MakeLog(
        string entityType,
        Guid entityId,
        string action,
        string userId,
        DateTime occurredAtUtc)
    {
        return new AuditLog
        {
            Id = Guid.NewGuid(),
            EntityType = entityType,
            EntityId = entityId,
            Action = action,
            UserId = userId,
            OccurredAtUtc = occurredAtUtc
        };
    }
}
