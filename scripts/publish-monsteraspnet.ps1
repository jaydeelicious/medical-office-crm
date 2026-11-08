$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$angularRoot = Join-Path $repoRoot "medical-office-web"
$apiProject = Join-Path $repoRoot "MedicalOffice.Api/MedicalOffice.Api.csproj"

$publishDirectory = Join-Path $repoRoot "artifacts/monsteraspnet"
$angularBrowserDirectory = Join-Path $angularRoot "dist/medical-office-web/browser"
$wwwroot = Join-Path $publishDirectory "wwwroot"

Write-Host "Publishing Medical Office CRM for MonsterASP.NET..."

# Clean previous deployment artifacts.
if (Test-Path $publishDirectory) {
    Remove-Item $publishDirectory -Recurse -Force
}

# Build Angular.
Push-Location $angularRoot

try {
    npm ci
    if ($LASTEXITCODE -ne 0) {
        throw "npm ci failed."
    }

    npm run build -- --configuration production
    if ($LASTEXITCODE -ne 0) {
        throw "Angular production build failed."
    }
}
finally {
    Pop-Location
}

if (-not (Test-Path (Join-Path $angularBrowserDirectory "index.html"))) {
    throw "Angular browser build output was not found."
}

# Publish ASP.NET Core.
dotnet publish $apiProject `
    --configuration Release `
    --output $publishDirectory `
    /p:UseAppHost=false

if ($LASTEXITCODE -ne 0) {
    throw "ASP.NET Core publish failed."
}

# Copy Angular assets into ASP.NET Core's web root.
New-Item -ItemType Directory -Force -Path $wwwroot | Out-Null

Copy-Item `
    -Path (Join-Path $angularBrowserDirectory "*") `
    -Destination $wwwroot `
    -Recurse `
    -Force

# Generate public OIDC runtime configuration.
# This file must never contain secrets.
$runtimeConfig = @'
window.__medicalOfficeConfig = {
    authority: window.location.origin + "/"
};
'@

Set-Content `
    -Path (Join-Path $wwwroot "runtime-config.js") `
    -Value $runtimeConfig `
    -Encoding utf8

Write-Host ""
Write-Host "Publish completed successfully."
Write-Host "Output: $publishDirectory"
