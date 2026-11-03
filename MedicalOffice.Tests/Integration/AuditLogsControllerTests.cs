
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
