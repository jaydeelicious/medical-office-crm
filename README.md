# Medical Office CRM

Backend API for managing patients, doctors and appointments
in a medical office.

## Tech Stack

- .NET 10
- ASP.NET Core Web API
- Entity Framework Core
- SQL Server
- FluentValidation
- xUnit
- Moq
- FluentAssertions
- Swagger

## Architecture

The solution is divided into:

- `MedicalOffice.Api` - HTTP API, controllers, exception handling
- `MedicalOffice.Application` - application services, DTOs, validation, repository abstractions
- `MedicalOffice.Domain` - domain entities and enums
- `MedicalOffice.Infrastructure` - EF Core persistence and repository implementations
- `MedicalOffice.Tests` - automated tests

## Features

- Patient CRUD
- Doctor CRUD
- Appointment scheduling
- Appointment rescheduling
- Appointment status management
- Prevention of overlapping doctor appointments
- FluentValidation request validation
- Global API exception handling
- Unit tests

## Running Locally

### Requirements

- .NET 10 SDK
- SQL Server LocalDB or another SQL Server instance

### Configure the database

1. Configure the connection string in `MedicalOffice.Api/appsettings.json`.
2. Apply migrations:

```bash
dotnet ef database update \
  --project MedicalOffice.Infrastructure \
  --startup-project MedicalOffice.Api