param(
    [string]$Runtime = "win-x64",
    [string]$Configuration = "Release",
    [switch]$SkipFrontendInstall,
    [switch]$SelfContained = $true
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendPath = Join-Path $root 'frontend'
$backendPath = Join-Path $root 'backend\AgentStudio.Api'
$wwwrootPath = Join-Path $backendPath 'wwwroot'
$publishPath = Join-Path $root 'publish\AgentStudio'

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
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
if (Test-Path $publishPath) {
    Remove-Item -LiteralPath $publishPath -Recurse -Force
}

$selfContainedArg = if ($SelfContained) { 'true' } else { 'false' }
dotnet publish $backendPath `
    -c $Configuration `
    -r $Runtime `
    --self-contained $selfContainedArg `
    /p:PublishSingleFile=true `
    /p:IncludeNativeLibrariesForSelfExtract=true `
    -o $publishPath

Write-Step "Publish completed"
Write-Host "Output folder: $publishPath" -ForegroundColor Green
Write-Host "Executable: $(Join-Path $publishPath 'AgentStudio.Api.exe')" -ForegroundColor Green
Write-Host "Run the app, then open: http://localhost:5298" -ForegroundColor Green
