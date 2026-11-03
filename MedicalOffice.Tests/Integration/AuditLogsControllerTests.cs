
using FluentAssertions;
using MedicalOffice.Application.AuditLogs;
using MedicalOffice.Application.Common;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace MedicalOffice.Tests.Integration;

public class AuditLogsControllerTests
{
    [Fact]
    public async Task GetPaged_Admin_ShouldReturnAuditHistory()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        var log = await SeedAuditLogAsync(factory);

        client.DefaultRequestHeaders.Add("X-Test-Auth", "Admin");

        var response = await client.GetAsync("/api/audit-logs");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content
            .ReadFromJsonAsync<PagedResult<AuditLogDto>>();

        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items.Should().ContainSingle();
        result.Items[0].Id.Should().Be(log.Id);
    }

    [Fact]
    public async Task GetPaged_NonAdmin_ShouldReturnForbidden()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        await SeedAuditLogAsync(factory);

        // No header: authenticated ordinary staff user.
        var response = await client.GetAsync("/api/audit-logs");

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task GetPaged_Anonymous_ShouldReturnUnauthorized()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        client.DefaultRequestHeaders.Add(
            "X-Test-Auth", "Anonymous");

        var response = await client.GetAsync("/api/audit-logs");

        response.StatusCode.Should()
            .Be(HttpStatusCode.Unauthorized);
    }


    [Fact]
    public async Task GetById_Admin_ShouldReturnAuditLog()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        var log = await SeedAuditLogAsync(factory);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            var exists = await db.AuditLogs
                .AsNoTracking()
                .AnyAsync(a => a.Id == log.Id);

            exists.Should().BeTrue();
        }

        client.DefaultRequestHeaders.Add("X-Test-Auth", "Admin");

        var response = await client.GetAsync(
            $"/api/audit-logs/{log.Id}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content
            .ReadFromJsonAsync<AuditLogDto>();

        var body = await response.Content.ReadAsStringAsync();

        response.StatusCode.Should().Be(
            HttpStatusCode.OK,
            $"response body: {body}");

        var list = await client.GetFromJsonAsync<PagedResult<AuditLogDto>>(
            "/api/audit-logs");

        list.Should().NotBeNull();
        list!.Items.Should().Contain(a => a.Id == log.Id);

        result.Should().NotBeNull();
        result!.Id.Should().Be(log.Id);
        result.EntityType.Should().Be("Patient");
        result.EntityId.Should().Be(log.EntityId);
        result.Action.Should().Be("Updated");
        result.UserId.Should().Be("test-user-id");
    }


    [Fact]
    public async Task GetById_MissingAuditLog_ShouldReturnNotFound()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        await SeedAuditLogAsync(factory);

        client.DefaultRequestHeaders.Add("X-Test-Auth", "Admin");

        var response = await client.GetAsync(
            $"/api/audit-logs/{Guid.NewGuid()}");

        response.StatusCode.Should()
            .Be(HttpStatusCode.NotFound);
    }


    [Theory]
    [InlineData("?page=0")]
    [InlineData("?page=-1")]
    [InlineData("?pageSize=0")]
    [InlineData("?pageSize=101")]
    [InlineData("?entityType=Unknown")]
    [InlineData("?action=Modified")]
    [InlineData("?entityId=00000000-0000-0000-0000-000000000000")]
    [InlineData("?fromUtc=2026-11-05T00:00:00Z&toUtc=2026-11-03T00:00:00Z")]
    public async Task GetPaged_InvalidQuery_ShouldReturnBadRequest(
        string queryString)
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        await SeedAuditLogAsync(factory);

        client.DefaultRequestHeaders.Add("X-Test-Auth", "Admin");

        var response = await client.GetAsync(
            $"/api/audit-logs{queryString}");

        response.StatusCode.Should()
            .Be(HttpStatusCode.BadRequest);
    }


    [Fact]
    public async Task GetById_ShouldNotExposeSensitiveAuditFields()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        var log = await SeedAuditLogAsync(factory);

        client.DefaultRequestHeaders.Add("X-Test-Auth", "Admin");

        var response = await client.GetAsync(
            $"/api/audit-logs/{log.Id}");

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        using var document = JsonDocument.Parse(
            await response.Content.ReadAsStringAsync());

        var root = document.RootElement;

        root.TryGetProperty("id", out _).Should().BeTrue();
        root.TryGetProperty("entityType", out _).Should().BeTrue();
        root.TryGetProperty("action", out _).Should().BeTrue();

        root.TryGetProperty("changesJson", out _)
            .Should().BeFalse();

        root.TryGetProperty("correlationId", out _)
            .Should().BeFalse();

        var json = root.GetRawText();

        json.Should().NotContain("PrivateData");
        json.Should().NotContain("internal-correlation");
    }


    [Fact]
    public async Task GetPaged_CombinedFilters_ShouldReturnOnlyMatchingRecords()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        var targetEntityId = Guid.NewGuid();
        var otherEntityId = Guid.NewGuid();

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            await db.Database.EnsureCreatedAsync();

            var timestamp = new DateTime(
                2026, 11, 3, 10, 0, 0, DateTimeKind.Utc);

            db.AuditLogs.AddRange(
                new AuditLog
                {
                    Id = Guid.NewGuid(),
                    EntityType = "Patient",
                    EntityId = targetEntityId,
                    Action = "Updated",
                    UserId = "user-1",
                    OccurredAtUtc = timestamp
                },
                new AuditLog
                {
                    Id = Guid.NewGuid(),
                    EntityType = "Patient",
                    EntityId = targetEntityId,
                    Action = "Created",
                    UserId = "user-1",
                    OccurredAtUtc = timestamp.AddHours(-1)
                },
                new AuditLog
                {
                    Id = Guid.NewGuid(),
                    EntityType = "Patient",
                    EntityId = otherEntityId,
                    Action = "Updated",
                    UserId = "user-1",
                    OccurredAtUtc = timestamp
                },
                new AuditLog
                {
                    Id = Guid.NewGuid(),
                    EntityType = "Patient",
                    EntityId = targetEntityId,
                    Action = "Updated",
                    UserId = "user-2",
                    OccurredAtUtc = timestamp
                },
                new AuditLog
                {
                    Id = Guid.NewGuid(),
                    EntityType = "Doctor",
                    EntityId = targetEntityId,
                    Action = "Updated",
                    UserId = "user-1",
                    OccurredAtUtc = timestamp
                }
            );

            await db.SaveChangesAsync();
        }

        client.DefaultRequestHeaders.Add("X-Test-Auth", "Admin");

        var url =
            $"/api/audit-logs?entityType=Patient" +
            $"&entityId={targetEntityId}" +
            "&action=Updated" +
            "&userId=user-1" +
            "&fromUtc=2026-11-03T00:00:00Z" +
            "&toUtc=2026-11-03T23:59:59Z";

        var response = await client.GetAsync(url);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var result = await response.Content
            .ReadFromJsonAsync<PagedResult<AuditLogDto>>();

        result.Should().NotBeNull();
        result!.TotalCount.Should().Be(1);
        result.Items.Should().ContainSingle();

        var item = result.Items[0];

        item.EntityType.Should().Be("Patient");
        item.EntityId.Should().Be(targetEntityId);
        item.Action.Should().Be("Updated");
        item.UserId.Should().Be("user-1");
    }


    [Fact]
    public async Task GetPaged_ShouldReturnDeterministicPaginatedHistory()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        var timestamp = new DateTime(
            2026, 11, 3, 10, 0, 0, DateTimeKind.Utc);

        var oldestId = Guid.Parse(
            "00000000-0000-0000-0000-000000000001");

        var tiedLowerId = Guid.Parse(
            "00000000-0000-0000-0000-000000000002");

        var tiedHigherId = Guid.Parse(
            "00000000-0000-0000-0000-000000000003");

        var newestId = Guid.Parse(
            "00000000-0000-0000-0000-000000000004");

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            await db.Database.EnsureCreatedAsync();

            AuditLog CreateLog(Guid id, DateTime occurredAt) => new()
            {
                Id = id,
                EntityType = "Patient",
                EntityId = Guid.NewGuid(),
                Action = "Updated",
                UserId = "test-user-id",
                OccurredAtUtc = occurredAt
            };

            db.AuditLogs.AddRange(
                CreateLog(oldestId, timestamp.AddHours(-1)),
                CreateLog(tiedLowerId, timestamp),
                CreateLog(tiedHigherId, timestamp),
                CreateLog(newestId, timestamp.AddHours(1))
            );

            await db.SaveChangesAsync();
        }

        client.DefaultRequestHeaders.Add("X-Test-Auth", "Admin");

        var page1 = await client.GetFromJsonAsync<PagedResult<AuditLogDto>>(
            "/api/audit-logs?page=1&pageSize=2");

        var page2 = await client.GetFromJsonAsync<PagedResult<AuditLogDto>>(
            "/api/audit-logs?page=2&pageSize=2");

        var page3 = await client.GetFromJsonAsync<PagedResult<AuditLogDto>>(
            "/api/audit-logs?page=3&pageSize=2");

        page1.Should().NotBeNull();
        page2.Should().NotBeNull();
        page3.Should().NotBeNull();

        page1!.TotalCount.Should().Be(4);
        page2!.TotalCount.Should().Be(4);
        page3!.TotalCount.Should().Be(4);

        page1.Page.Should().Be(1);
        page1.PageSize.Should().Be(2);
        page2.Page.Should().Be(2);

        page1.Items.Select(a => a.Id)
            .Should().Equal(newestId, tiedHigherId);

        page2.Items.Select(a => a.Id)
            .Should().Equal(tiedLowerId, oldestId);

        page3.Items.Should().BeEmpty();
    }


    [Fact]
    public async Task GetById_NonAdmin_ShouldReturnForbidden()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        var log = await SeedAuditLogAsync(factory);

        // Default test identity is authenticated but has no Admin role.
        var response = await client.GetAsync(
            $"/api/audit-logs/{log.Id}");

        response.StatusCode.Should()
            .Be(HttpStatusCode.Forbidden);
    }


    [Fact]
    public async Task AuditHistoryReads_ShouldNotGenerateAdditionalAuditLogs()
    {
        using var factory = new CustomWebApplicationFactory();
        using var client = factory.CreateClient();

        var log = await SeedAuditLogAsync(factory);

        client.DefaultRequestHeaders.Add("X-Test-Auth", "Admin");

        int initialCount;

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider
                .GetRequiredService<MedicalOfficeDbContext>();

            initialCount = await db.AuditLogs.CountAsync();
        }

        var listResponse = await client.GetAsync("/api/audit-logs");

        var detailResponse = await client.GetAsync(
            $"/api/audit-logs/{log.Id}");

        listResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        detailResponse.StatusCode.Should().Be(HttpStatusCode.OK);

        using var verificationScope = factory.Services.CreateScope();

        var verificationDb = verificationScope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        var finalCount = await verificationDb.AuditLogs.CountAsync();

        finalCount.Should().Be(initialCount);
    }


    private static async Task<AuditLog> SeedAuditLogAsync(
        CustomWebApplicationFactory factory)
    {
        using var scope = factory.Services.CreateScope();

        var db = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await db.Database.EnsureCreatedAsync();

        var log = new AuditLog
        {
            Id = Guid.NewGuid(),
            OccurredAtUtc = new DateTime(
                2026, 11, 3, 10, 0, 0, DateTimeKind.Utc),
            EntityType = "Patient",
            EntityId = Guid.NewGuid(),
            Action = "Updated",
            UserId = "test-user-id",
            ChangesJson = """{"Sensitive":"PrivateData"}""",
            CorrelationId = "internal-correlation"
        };

        db.AuditLogs.Add(log);
        await db.SaveChangesAsync();

        return log;
    }
}
