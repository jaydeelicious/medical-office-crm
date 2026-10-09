using System.Data.Common;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MedicalOffice.Infrastructure.Persistence;
using MedicalOffice.Tests.Integration.Authentication;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;

namespace MedicalOffice.Tests.Integration
{
    public class CustomWebApplicationFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");

            builder.ConfigureServices(services =>
            {
                // Remove the application's SQL Server configuration.
                services.RemoveAll<DbContextOptions<MedicalOfficeDbContext>>();

                services.RemoveAll<IDbContextOptionsConfiguration<MedicalOfficeDbContext>>();

                // Keep the SQLite database alive for the test host.
                services.AddSingleton<DbConnection>(_ =>
                {
                    var connection = new SqliteConnection("Data Source=:memory:");
                    connection.Open();
                    return connection;
                });

                services.AddDbContext<MedicalOfficeDbContext>((serviceProvider, options) =>
                {
                    var connection = serviceProvider.GetRequiredService<DbConnection>();

                    options.UseSqlite(connection);
                    options.UseOpenIddict();
                });

                services
                    .AddAuthentication()
                    .AddScheme<AuthenticationSchemeOptions, TestAuthHandler>(
                        TestAuthHandler.Scheme,
                        options => { });

                // Replace the production API policy only in the test host.
                services.PostConfigure<AuthorizationOptions>(options =>
                {
                    options.AddPolicy("ApiBearer", new AuthorizationPolicyBuilder(
                        TestAuthHandler.Scheme)
                        .RequireAuthenticatedUser()
                        .Build());
                });
            });
        }
    }
}
