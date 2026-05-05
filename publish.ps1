param(
    [string]$Runtime = "win-x64",
    [string]$Configuration = "Release",
    [switch]$SkipFrontendInstall,
    [int]$Port = 5298,
    [switch]$SelfContained = $true
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendPath = Join-Path $root 'frontend'
$backendPath = Join-Path $root 'backend\AgentStudio.Api'
$wwwrootPath = Join-Path $backendPath 'wwwroot'
$publishBasePath = Join-Path $root 'publish\AgentStudio'
$publishPath = $publishBasePath
$appSettingsPath = ''
$startScriptPath = ''

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Resolve-PublishOutputPath {
    param([string]$PreferredPath)

    if (-not (Test-Path $PreferredPath)) {
        return $PreferredPath
    }

    try {
        Remove-Item -LiteralPath $PreferredPath -Recurse -Force
        return $PreferredPath
    }
    catch {
        $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
        $fallbackPath = "$PreferredPath-$timestamp"
        Write-Host "Publish folder is busy, using fallback output: $fallbackPath" -ForegroundColor Yellow
        Write-Host "Tip: stop the running app if you want to reuse the stable folder '$PreferredPath'." -ForegroundColor Yellow
        return $fallbackPath
    }
}

Write-Step "Building backend"
dotnet build (Join-Path $root 'AgentStudio.sln') -c $Configuration

if (-not $SkipFrontendInstall) {
    Write-Step "Installing frontend dependencies"
    Push-Location $frontendPath
    try {
        npm.cmd install
    }
    finally {
        Pop-Location
    }
}

Write-Step "Building frontend"
Push-Location $frontendPath
try {
    npm.cmd run build
}
finally {
    Pop-Location
}

Write-Step "Preparing backend wwwroot"
if (Test-Path $wwwrootPath) {
    Remove-Item -LiteralPath $wwwrootPath -Recurse -Force
}
New-Item -ItemType Directory -Path $wwwrootPath -Force | Out-Null
Copy-Item -Path (Join-Path $frontendPath 'dist\*') -Destination $wwwrootPath -Recurse -Force

Write-Step "Publishing executable"
$publishPath = Resolve-PublishOutputPath -PreferredPath $publishBasePath
$appSettingsPath = Join-Path $publishPath 'appsettings.json'
$startScriptPath = Join-Path $publishPath 'start-agentstudio.bat'

$selfContainedArg = if ($SelfContained) { 'true' } else { 'false' }
dotnet publish $backendPath `
    -c $Configuration `
    -r $Runtime `
    --self-contained $selfContainedArg `
    /p:PublishSingleFile=true `
    /p:IncludeNativeLibrariesForSelfExtract=true `
    -o $publishPath

Write-Step "Configuring published port"
$appSettings = Get-Content $appSettingsPath -Raw | ConvertFrom-Json
if (-not $appSettings.Server) {
    $appSettings | Add-Member -MemberType NoteProperty -Name Server -Value ([pscustomobject]@{ Port = $Port })
}
else {
    $appSettings.Server.Port = $Port
}
$appSettings | ConvertTo-Json -Depth 10 | Set-Content $appSettingsPath

$startScript = @"
@echo off
setlocal
set "PORT=%~1"
if "%PORT%"=="" set "PORT=$Port"
set "ASPNETCORE_URLS=http://localhost:%PORT%"
"%~dp0AgentStudio.Api.exe"
endlocal
"@
Set-Content -Path $startScriptPath -Value $startScript

Write-Step "Publish completed"
Write-Host "Output folder: $publishPath" -ForegroundColor Green
Write-Host "Executable: $(Join-Path $publishPath 'AgentStudio.Api.exe')" -ForegroundColor Green
Write-Host "Default URL: http://localhost:$Port" -ForegroundColor Green
Write-Host "Quick custom port: $(Join-Path $publishPath 'start-agentstudio.bat') 8080" -ForegroundColor Green
