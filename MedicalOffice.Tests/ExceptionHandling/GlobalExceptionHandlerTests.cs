
using System.Text.Json;
using FluentAssertions;
using MedicalOffice.Api.ExceptionHandling;
using MedicalOffice.Application.Exceptions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;

namespace MedicalOffice.Tests.ExceptionHandling;

public class GlobalExceptionHandlerTests
{
    [Fact]
    public async Task DbUpdateConcurrencyException_ReturnsStaleAppointmentConflict()
    {
        var exception = new DbUpdateConcurrencyException(
            "Internal EF Core concurrency details");

        using var json = await HandleExceptionAsync(exception);

        json.RootElement
            .GetProperty("status")
            .GetInt32()
            .Should().Be(409);

        json.RootElement
            .GetProperty("code")
            .GetString()
            .Should().Be(ConflictCodes.StaleAppointment);

        json.RootElement
            .GetProperty("detail")
            .GetString()
            .Should().NotContain("Internal EF Core");
    }

    [Fact]
    public async Task UnexpectedException_DoesNotExposeInternalDetails()
    {
        var exception = new InvalidOperationException(
            "Sensitive internal implementation details");

        using var json = await HandleExceptionAsync(exception);

        json.RootElement
            .GetProperty("status")
            .GetInt32()
            .Should().Be(500);

        json.RootElement
            .GetProperty("detail")
            .GetString()
            .Should().Be("An unexpected server error occurred.");

        json.RootElement
            .TryGetProperty("code", out _)
            .Should().BeFalse();
    }

    private static async Task<JsonDocument> HandleExceptionAsync(
        Exception exception)
    {
        var services = new ServiceCollection()
            .AddLogging()
            .AddOptions()
            .BuildServiceProvider();

        using (services)
        {
            var context = new DefaultHttpContext
            {
                RequestServices = services
            };

            await using var stream = new MemoryStream();
            context.Response.Body = stream;

            var handler = new GlobalExceptionHandler(
                NullLogger<GlobalExceptionHandler>.Instance);

            var handled = await handler.TryHandleAsync(
                context,
                exception,
                CancellationToken.None);

            handled.Should().BeTrue();

            stream.Position = 0;

            return await JsonDocument.ParseAsync(stream);
        }
    }
}
