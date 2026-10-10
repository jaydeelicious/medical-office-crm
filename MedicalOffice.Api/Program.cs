using MedicalOffice.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

using MedicalOffice.Application.Abstractions;
using MedicalOffice.Infrastructure.Repositories;

using MedicalOffice.Application.Patients;
using MedicalOffice.Application.Doctors;
using MedicalOffice.Application.Appointments;

using MedicalOffice.Api.ExceptionHandling;

using FluentValidation;

using MedicalOffice.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;

using MedicalOffice.Api.Extensions;

using OpenIddict.Validation.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllersWithViews();

builder.Services.AddDbContext<MedicalOfficeDbContext>(
    options =>
    {
        options.UseSqlServer(
            builder.Configuration.GetConnectionString("DefaultConnection"));

        options.UseOpenIddict();
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
    

builder.Services.AddScoped<IPatientRepository, PatientRepository>();
builder.Services.AddScoped<PatientService>();

builder.Services.AddScoped<IDoctorRepository, DoctorRepository>();
builder.Services.AddScoped<DoctorService>();

builder.Services.AddScoped<IAppointmentRepository, AppointmentRepository>();
builder.Services.AddScoped<AppointmentService>();

builder.Services.AddValidatorsFromAssemblyContaining<CreatePatientRequestValidator>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
//builder.Services.AddOpenApi();

builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// Required by Identity's data protection token providers
builder.Services.AddDataProtection();

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
});

var app = builder.Build();

app.UseExceptionHandler();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    //app.MapOpenApi();
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

public partial class Program { }
