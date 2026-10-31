
using FluentAssertions;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MedicalOffice.Tests.Integration
{
    public class AuditLogPersistenceTests
    {
        [Fact]
        public async Task AuditLog_ShouldBePersistedAndRetrieved()
        {
            // Arrange
            using var factory = new CustomWebApplicationFactory();
            using var client = factory.CreateClient();
            using var scope = factory.Services.CreateScope();

            var dbContext = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            await dbContext.Database.EnsureCreatedAsync();

            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                OccurredAtUtc = new DateTime(
                    2026, 10, 31, 12, 0, 0,
                    DateTimeKind.Utc),
                EntityType = "Appointment",
                EntityId = Guid.NewGuid(),
                Action = "Updated",
                UserId = "test-user-id",
                ChangesJson =
                    """{"Status":{"old":"Scheduled","new":"Cancelled"}}""",
                CorrelationId = "test-correlation-id"
            };

            // Act
            dbContext.AuditLogs.Add(auditLog);
            await dbContext.SaveChangesAsync();

            dbContext.ChangeTracker.Clear();

            var persistedLog = await dbContext.AuditLogs
                .AsNoTracking()
                .SingleAsync(a => a.Id == auditLog.Id);

            // Assert
            persistedLog.Id.Should().Be(auditLog.Id);
            persistedLog.OccurredAtUtc.Should()
                .Be(auditLog.OccurredAtUtc);

            persistedLog.EntityType.Should()
                .Be("Appointment");

            persistedLog.EntityId.Should()
                .Be(auditLog.EntityId);

            persistedLog.Action.Should()
                .Be("Updated");

            persistedLog.UserId.Should()
                .Be("test-user-id");

            persistedLog.ChangesJson.Should()
                .Be(auditLog.ChangesJson);

            persistedLog.CorrelationId.Should()
                .Be("test-correlation-id");
        }

        [Fact]
        public async Task AuditLog_ShouldAllowNullableOptionalFields()
        {
            // Arrange
            using var factory = new CustomWebApplicationFactory();
            using var client = factory.CreateClient();
            using var scope = factory.Services.CreateScope();

            var dbContext = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            await dbContext.Database.EnsureCreatedAsync();

            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                OccurredAtUtc = DateTime.UtcNow,
                EntityType = "Patient",
                EntityId = Guid.NewGuid(),
                Action = "Created",
                UserId = null,
                ChangesJson = null,
                CorrelationId = null
            };

            // Act
            dbContext.AuditLogs.Add(auditLog);
            await dbContext.SaveChangesAsync();

            dbContext.ChangeTracker.Clear();

            var persistedLog = await dbContext.AuditLogs
                .AsNoTracking()
                .SingleAsync(a => a.Id == auditLog.Id);

            // Assert
            persistedLog.Should().NotBeNull();
            persistedLog.UserId.Should().BeNull();
            persistedLog.ChangesJson.Should().BeNull();
            persistedLog.CorrelationId.Should().BeNull();
        }

        [Fact]
        public async Task AuditLog_ShouldPersistWithoutRelatedEntityOrUser()
        {
            // Arrange
            using var factory = new CustomWebApplicationFactory();
            using var client = factory.CreateClient();
            using var scope = factory.Services.CreateScope();

            var dbContext = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            await dbContext.Database.EnsureCreatedAsync();

            var entityId = Guid.NewGuid();

            var auditLog = new AuditLog
            {
                Id = Guid.NewGuid(),
                OccurredAtUtc = DateTime.UtcNow,
                EntityType = "Patient",
                EntityId = entityId,
                Action = "Deleted",
                UserId = "deleted-user-id"
            };

            // Act
            dbContext.AuditLogs.Add(auditLog);
            await dbContext.SaveChangesAsync();

            dbContext.ChangeTracker.Clear();

            var persistedLog = await dbContext.AuditLogs
                .AsNoTracking()
                .SingleAsync(a => a.Id == auditLog.Id);

            // Assert
            persistedLog.EntityId.Should().Be(entityId);
            persistedLog.UserId.Should().Be("deleted-user-id");
        }
    }
}
