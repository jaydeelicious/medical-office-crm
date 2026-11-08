using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

using MedicalOffice.Application.Abstractions;
using MedicalOffice.Infrastructure.Repositories;

using MedicalOffice.Application.Patients;
using MedicalOffice.Application.Doctors;
using MedicalOffice.Application.Appointments;
using MedicalOffice.Application.AuditLogs;

using MedicalOffice.Api.ExceptionHandling;

using FluentValidation;

using MedicalOffice.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;

using MedicalOffice.Api.Extensions;

using OpenIddict.Validation.AspNetCore;

using MedicalOffice.Api.Authentication;
using Microsoft.AspNetCore.Mvc;

using MedicalOffice.Infrastructure.Persistence.Interceptors;

using Microsoft.AspNetCore.HttpOverrides;
using System.Net;
using System.Runtime.InteropServices;

using System.IO;
using Microsoft.AspNetCore.DataProtection;

var builder = WebApplication.CreateBuilder(args);

var trustedProxy = builder.Configuration["ReverseProxy:KnownProxy"];

if (!string.IsNullOrWhiteSpace(trustedProxy))
{
    if (!IPAddress.TryParse(trustedProxy, out var proxyAddress))
    {
        throw new InvalidOperationException("ReverseProxy:KnownProxy must be a valid IP address.");
    }

    builder.Services.Configure<ForwardedHeadersOptions>(options =>
    {
        options.ForwardedHeaders =
            ForwardedHeaders.XForwardedFor |
            ForwardedHeaders.XForwardedProto;

        options.ForwardLimit = 1;

        options.KnownProxies.Add(proxyAddress);

        if (proxyAddress.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
        {
            options.KnownProxies.Add(proxyAddress.MapToIPv6());
        }
    });
}

// Add services to the container.
builder.Services.AddControllersWithViews();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularClient", policy =>
    {
        policy.WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddDbContext<MedicalOfficeDbContext>(
    (serviceProvider, options) =>
    {
        options.UseSqlServer(
            builder.Configuration.GetConnectionString("DefaultConnection"));

        options.UseOpenIddict();

        options.AddInterceptors(
            serviceProvider.GetRequiredService<AuditSaveChangesInterceptor>());
    });

builder.Services.AddOpenIddict()
    .AddCore(options =>
    {
        options.UseEntityFrameworkCore()
            .UseDbContext<MedicalOfficeDbContext>();
    });

builder.Services.AddOpenIddictServer(
    builder.Environment,
    builder.Configuration);

builder.Services.AddScoped<OpenIddictClientSeeder>();

builder.Services.AddScoped<IPatientRepository, PatientRepository>();
builder.Services.AddScoped<PatientService>();

builder.Services.AddScoped<IDoctorRepository, DoctorRepository>();
builder.Services.AddScoped<DoctorService>();

builder.Services.AddScoped<IAppointmentRepository, AppointmentRepository>();
builder.Services.AddScoped<AppointmentService>();

builder.Services.AddScoped<IAuditLogRepository, AuditLogRepository>();
builder.Services.AddScoped<AuditLogService>();

builder.Services.AddTransient<AuditSaveChangesInterceptor>();

builder.Services.AddHttpContextAccessor();

builder.Services.AddScoped<ICurrentUserService, HttpCurrentUserService>();

builder.Services.AddValidatorsFromAssemblyContaining<CreatePatientRequestValidator>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
//builder.Services.AddOpenApi();

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// Required by Identity's data protection token providers
var dataProtection = builder.Services.AddDataProtection();

var keyDirectory = builder.Configuration["DataProtection:KeysDirectory"];

if (!string.IsNullOrWhiteSpace(keyDirectory))
{
    var resolvedKeyDirectory = Path.IsPathFullyQualified(keyDirectory)
        ? keyDirectory
        : Path.GetFullPath(
            keyDirectory,
            builder.Environment.ContentRootPath);

    Directory.CreateDirectory(resolvedKeyDirectory);

    dataProtection
        .SetApplicationName("MedicalOfficeCRM")
        .PersistKeysToFileSystem(
            new DirectoryInfo(keyDirectory));
}

builder.Services
    .AddIdentityCore<ApplicationUser>(options =>
    {
        options.Password.RequiredLength = 12;
        options.Password.RequireDigit = true;
        options.Password.RequireUppercase = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireNonAlphanumeric = true;

        options.Lockout.DefaultLockoutTimeSpan =
            TimeSpan.FromMinutes(15);

        options.Lockout.MaxFailedAccessAttempts = 5;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<MedicalOfficeDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme =
            IdentityConstants.ApplicationScheme;

        options.DefaultChallengeScheme =
            IdentityConstants.ApplicationScheme;

        options.DefaultSignInScheme =
            IdentityConstants.ExternalScheme;
    })
    .AddIdentityCookies();

builder.Services.ConfigureApplicationCookie(options =>
{
    options.Cookie.Name = "MedicalOffice.Identity";
    options.Cookie.HttpOnly = true;
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Lax;

    options.LoginPath = "/account/login";
    options.AccessDeniedPath = "/account/access-denied";

    options.ExpireTimeSpan = TimeSpan.FromMinutes(30);
    options.SlidingExpiration = false;
});

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("ApiBearer", policy =>
    {
        policy.AddAuthenticationSchemes(
            OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme);

        policy.RequireAuthenticatedUser();
    });

    // Authentication for browser sessions using Identity cookies
    options.AddPolicy("IdentityCookie", policy =>
    {
        policy.AddAuthenticationSchemes(
            IdentityConstants.ApplicationScheme);

        policy.RequireAuthenticatedUser();
    });

    options.AddPolicy("AuditRead", policy =>
    {
        policy.AddAuthenticationSchemes(
            OpenIddictValidationAspNetCoreDefaults.AuthenticationScheme);

        policy.RequireAuthenticatedUser();
        policy.RequireRole("Admin");
    });
});

var app = builder.Build();

if (!string.IsNullOrWhiteSpace(trustedProxy))
{
    app.UseForwardedHeaders();
}

if (app.Configuration.GetValue(
    "OpenIddict:Clients:SeedOnStartup", true))
{
    using var scope = app.Services.CreateScope();

    var seeder = scope.ServiceProvider
        .GetRequiredService<OpenIddictClientSeeder>();

    await seeder.SeedAsync();
}

if (app.Environment.IsDevelopment() &&
    app.Configuration.GetValue<bool>("DevelopmentTestUser:SeedOnStartup"))
{
    using var scope = app.Services.CreateScope();

    await DevelopmentUserSeeder.SeedAsync(
        scope.ServiceProvider,
        app.Configuration);
}

app.UseExceptionHandler();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    //app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Optional SPA hosting for single-origin deployments.
// The Docker deployment continues using Nginx.
var serveSpa = app.Configuration.GetValue<bool>("Hosting:ServeSpa");

if (serveSpa)
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

app.UseRouting();
app.UseCors("AngularClient");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.MapGet("/api/health", () =>
    Results.Ok(new
    {
        Status = "Healthy"
    }))
    .AllowAnonymous();

// Let Angular handle client-side routes when SPA hosting is enabled.
if (serveSpa)
{
    app.MapFallbackToFile("index.html");
}

app.Run();

public partial class Program { }
