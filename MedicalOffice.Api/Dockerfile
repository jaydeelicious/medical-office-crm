
# syntax=docker/dockerfile:1

# Stage 1: Build and publish
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build

WORKDIR /src

# Copy project files for dependency caching
COPY MedicalOffice.Domain/MedicalOffice.Domain.csproj MedicalOffice.Domain/
COPY MedicalOffice.Application/MedicalOffice.Application.csproj MedicalOffice.Application/
COPY MedicalOffice.Infrastructure/MedicalOffice.Infrastructure.csproj MedicalOffice.Infrastructure/
COPY MedicalOffice.Api/MedicalOffice.Api.csproj MedicalOffice.Api/

# Restore dependencies
RUN dotnet restore MedicalOffice.Api/MedicalOffice.Api.csproj

# Copy remaining source code
COPY . .

# Publish in Release configuration
RUN dotnet publish MedicalOffice.Api/MedicalOffice.Api.csproj \
    --configuration Release \
    --output /app/publish \
    --no-restore \
    /p:UseAppHost=false

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime

WORKDIR /app

ENV ASPNETCORE_HTTP_PORTS=8080
ENV ASPNETCORE_ENVIRONMENT=Production

COPY --from=build /app/publish .

# Prepare the Data Protection directory for the non-root user.
RUN mkdir -p /app/data-protection-keys \
    && chown -R $APP_UID:$APP_UID /app/data-protection-keys

# Run as non-root user
USER $APP_UID

EXPOSE 8080

ENTRYPOINT ["dotnet", "MedicalOffice.Api.dll"]
