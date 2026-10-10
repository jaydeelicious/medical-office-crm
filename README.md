# Medical Office CRM

A full-stack medical office management application built with ASP.NET Core and Angular.

The project currently includes a .NET backend for managing patients, doctors and appointments in a medical office, alongside an OAuth 2.0 / OpenID Connect authentication server.

## Tech Stack

### Backend

- .NET 10
- ASP.NET Core Web API
- Entity Framework Core
- SQL Server
- ASP.NET Core Identity
- OpenIddict (OAuth 2.0 / OpenID Connect)
- FluentValidation
- Swagger / OpenAPI

### Testing

- xUnit
- Moq
- FluentAssertions
- ASP.NET Core integration testing
- SQLite (integration test database)

### Frontend (Planned)
- Angular

## Architecture

The solution is divided into:

- `MedicalOffice.Api` - HTTP API, controllers, exception handling
- `MedicalOffice.Application` - application services, DTOs, validation, repository abstractions
- `MedicalOffice.Domain` - domain entities and enums
- `MedicalOffice.Infrastructure` - EF Core persistence, repositories and ASP.NET Core Identity
- `MedicalOffice.Tests` - unit and integration tests

## Features

- Patient CRUD
- Doctor CRUD
- Appointment scheduling and rescheduling
- Appointment status management
- Prevention of overlapping doctor appointments
- FluentValidation request validation
- Global API exception handling
- ASP.NET Core Identity login and logout
- OAuth 2.0 Authorization Code Flow with PKCE
- OpenID Connect authorization and token endpoints
- Bearer-token authentication for protected API endpoints

## Running Locally

### Requirements

- .NET 10 SDK
- SQL Server LocalDB or another SQL Server instance
- EF Core CLI tools

### Configure the database

1. Configure the connection string in `MedicalOffice.Api/appsettings.json`.
2. Apply migrations:

```bash
dotnet ef database update --project MedicalOffice.Infrastructure --startup-project MedicalOffice.Api
 ```
 
### Run the API

```bash
dotnet run --project MedicalOffice.Api --launch-profile https
```

The API will be available at `https://localhost:7234`.

- Swagger UI: `https://localhost:7234/swagger`
  
### Run tests

```bash
dotnet test
```

## Roadmap

### v0.1.0
- Angular frontend
- Web-client registration and authentication integration
- Basic patient, doctor, and appointment management UI
- Automated testing and CI
- Containerized development setup
- Demo using fictional data
  