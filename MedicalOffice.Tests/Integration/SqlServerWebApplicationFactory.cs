using MedicalOffice.Infrastructure.Persistence;
using MedicalOffice.Tests.Integration.Authentication;
using MedicalOffice.Infrastructure.Persistence.Interceptors;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace MedicalOffice.Tests.Integration;

public sealed class SqlServerWebApplicationFactory
    : WebApplicationFactory<Program>
{
    private readonly string _databaseName =
        $"MedicalOffice_ConcurrencyTests_{Guid.NewGuid():N}";

    private string ConnectionString
    {
        get
        {
            var configuredConnection = Environment.GetEnvironmentVariable("MEDICALOFFICE_TEST_SQL_CONNECTION");

            var baseConnection = !string.IsNullOrWhiteSpace(
                configuredConnection)
                ? configuredConnection
                : @"Server=(localdb)\MSSQLLocalDB;Integrated Security=True;TrustServerCertificate=True;";

            var builder = new Microsoft.Data.SqlClient
                .SqlConnectionStringBuilder(baseConnection)
            {
                InitialCatalog = _databaseName
            };

            return builder.ConnectionString;
        }
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");

        builder.ConfigureAppConfiguration((context, config) =>
        {
            config.AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["OpenIddict:Clients:SeedOnStartup"] = "false",
                    ["DevelopmentTestUser:SeedOnStartup"] = "false"
                });
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<MedicalOfficeDbContext>>();

            services.RemoveAll<
                IDbContextOptionsConfiguration<MedicalOfficeDbContext>>();

            services.AddDbContext<MedicalOfficeDbContext>(
                (serviceProvider, options) =>
            {
                options.UseSqlServer(ConnectionString);

                options.UseOpenIddict();

                options.AddInterceptors(
                    serviceProvider.GetRequiredService<AuditSaveChangesInterceptor>());
            });

            services
                .AddAuthentication()
                .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                    TestAuthHandler.SchemeName,
                    _ => { });

            services.PostConfigure<AuthorizationOptions>(options =>
            {
                options.AddPolicy(
                    "ApiBearer",
                    new AuthorizationPolicyBuilder(
                        TestAuthHandler.SchemeName)
                        .RequireAuthenticatedUser()
                        .Build());
            });
        });
    }

    public async Task InitializeDatabaseAsync()
    {
        using var scope = Services.CreateScope();

        var db = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await db.Database.EnsureCreatedAsync();
    }

    public async Task DeleteDatabaseAsync()
    {
        using var scope = Services.CreateScope();

        var db = scope.ServiceProvider
            .GetRequiredService<MedicalOfficeDbContext>();

        await db.Database.EnsureDeletedAsync();
    }
}