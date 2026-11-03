
using FluentAssertions;
using MedicalOffice.Application.Abstractions;
using MedicalOffice.Application.AuditLogs;
using MedicalOffice.Application.Common;
using MedicalOffice.Domain.Entities;
using Moq;

namespace MedicalOffice.Tests.AuditLogs;

public class AuditLogServiceTests
{
    private readonly Mock<IAuditLogRepository> _repository = new();

    private AuditLogService CreateService() =>
        new(_repository.Object);

    [Theory]
    [InlineData(0, 20)]
    [InlineData(-1, 20)]
    [InlineData(1, 0)]
    [InlineData(1, 101)]
    [InlineData(1, -5)]
    public async Task GetPagedAsync_InvalidPagination_ShouldThrow(
        int page,
        int pageSize)
    {
        var service = CreateService();

        var query = new AuditLogQuery
        {
            Page = page,
            PageSize = pageSize
        };

        var action = () => service.GetPagedAsync(query);

        await action.Should()
            .ThrowAsync<ArgumentException>();

        _repository.Verify(
            r => r.GetPagedAsync(
                It.IsAny<AuditLogQuery>(),
                It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task GetPagedAsync_InvalidDateRange_ShouldThrow()
    {
        var service = CreateService();

        var query = new AuditLogQuery
        {
            FromUtc = new DateTime(
                2026, 11, 5, 0, 0, 0, DateTimeKind.Utc),
            ToUtc = new DateTime(
                2026, 11, 3, 0, 0, 0, DateTimeKind.Utc)
        };

        var action = () => service.GetPagedAsync(query);

        await action.Should()
            .ThrowAsync<ArgumentException>();
    }

    [Theory]
    [InlineData("Unknown", null)]
    [InlineData(null, "Modified")]
    public async Task GetPagedAsync_UnsupportedFilter_ShouldThrow(
        string? entityType,
        string? auditAction)
    {
        var service = CreateService();

        var query = new AuditLogQuery
        {
            EntityType = entityType,
            Action = auditAction
        };

        var action = () => service.GetPagedAsync(query);

        await action.Should()
            .ThrowAsync<ArgumentException>();
    }

    [Fact]
    public async Task GetPagedAsync_ShouldNormalizeFilters()
    {
        AuditLogQuery? capturedQuery = null;

        _repository
            .Setup(r => r.GetPagedAsync(
                It.IsAny<AuditLogQuery>(),
                It.IsAny<CancellationToken>()))
            .Callback<AuditLogQuery, CancellationToken>(
                (query, _) => capturedQuery = query)
            .ReturnsAsync(new PagedResult<AuditLog>());

        var service = CreateService();

        await service.GetPagedAsync(new AuditLogQuery
        {
            EntityType = " patient ",
            Action = " updated ",
            UserId = " user-123 "
        });

        capturedQuery.Should().NotBeNull();
        capturedQuery!.EntityType.Should().Be("Patient");
        capturedQuery.Action.Should().Be("Updated");
        capturedQuery.UserId.Should().Be("user-123");
    }

    [Fact]
    public async Task GetByIdAsync_ShouldMapSafeDto()
    {
        var id = Guid.NewGuid();

        var auditLog = new AuditLog
        {
            Id = id,
            EntityType = "Patient",
            EntityId = Guid.NewGuid(),
            Action = "Updated",
            OccurredAtUtc = DateTime.UtcNow,
            UserId = "user-123",
            ChangesJson = """{"Sensitive":"PrivateData"}""",
            CorrelationId = "internal-correlation"
        };

        _repository
            .Setup(r => r.GetByIdAsync(
                id,
                It.IsAny<CancellationToken>()))
            .ReturnsAsync(auditLog);

        var service = CreateService();

        var result = await service.GetByIdAsync(id);

        result.Should().NotBeNull();
        result!.Id.Should().Be(id);
        result.EntityType.Should().Be("Patient");
        result.Action.Should().Be("Updated");
        result.UserId.Should().Be("user-123");

        // Only approved fields should be exposed.
        typeof(AuditLogDto).GetProperty("ChangesJson")
            .Should().BeNull();

        typeof(AuditLogDto).GetProperty("CorrelationId")
            .Should().BeNull();
    }
}
