
using FluentAssertions;
using MedicalOffice.Application.Abstractions;
using MedicalOffice.Domain.Entities;
using MedicalOffice.Infrastructure.Persistence;
using MedicalOffice.Infrastructure.Persistence.Interceptors;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace MedicalOffice.Tests.Integration;

public class AuditUserIdentityEnforcementTests
{
    [Fact]
    public async Task AuthenticatedUserWithoutId_ShouldRejectBusinessSave()
    {
        // Arrange
        var currentUser = new Mock<ICurrentUserService>();

        currentUser.Setup(x => x.IsAuthenticated)
            .Returns(true);

        currentUser.Setup(x => x.UserId)
            .Returns((string?)null);

        await using var connection =
            new SqliteConnection("Data Source=:memory:");

        await connection.OpenAsync();

        var interceptor = new AuditSaveChangesInterceptor(
            currentUser.Object);

        var options =
            new DbContextOptionsBuilder<MedicalOfficeDbContext>()
                .UseSqlite(connection)
                .AddInterceptors(interceptor)
                .Options;

        await using var context =
            new MedicalOfficeDbContext(options);

        await context.Database.EnsureCreatedAsync();

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            FirstName = "Test",
            LastName = "Patient"
        };

        context.Patients.Add(patient);

        // Act
        var action = () => context.SaveChangesAsync();

        // Assert
        await action.Should()
            .ThrowAsync<InvalidOperationException>()
            .WithMessage(
                "Cannot audit an authenticated operation without a user ID.");

        (await context.Patients
            .AsNoTracking()
            .AnyAsync(p => p.Id == patient.Id))
            .Should().BeFalse();

        (await context.AuditLogs
            .AsNoTracking()
            .AnyAsync(a => a.EntityId == patient.Id))
            .Should().BeFalse();
    }

    [Fact]
    public async Task SystemOperation_ShouldPersistAuditLogWithoutUserId()
    {
        // Arrange
        var currentUser = new Mock<ICurrentUserService>();

        currentUser.Setup(x => x.IsAuthenticated)
            .Returns(false);

        currentUser.Setup(x => x.UserId)
            .Returns((string?)null);

        await using var connection =
            new SqliteConnection("Data Source=:memory:");

        await connection.OpenAsync();

        var interceptor = new AuditSaveChangesInterceptor(
            currentUser.Object);

        var options =
            new DbContextOptionsBuilder<MedicalOfficeDbContext>()
                .UseSqlite(connection)
                .AddInterceptors(interceptor)
                .Options;

        await using var context =
            new MedicalOfficeDbContext(options);

        await context.Database.EnsureCreatedAsync();

        var patient = new Patient
        {
            Id = Guid.NewGuid(),
            FirstName = "System",
            LastName = "Created"
        };

        context.Patients.Add(patient);

        // Act
        await context.SaveChangesAsync();

        // Assert
        var auditLog = await context.AuditLogs
            .AsNoTracking()
            .SingleAsync(a =>
                a.EntityType == "Patient" &&
                a.EntityId == patient.Id);

        auditLog.Action.Should().Be("Created");
        auditLog.UserId.Should().BeNull();

        (await context.Patients
            .AsNoTracking()
            .AnyAsync(p => p.Id == patient.Id))
            .Should().BeTrue();
    }
}
