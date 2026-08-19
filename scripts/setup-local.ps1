# MI-RA Studio - one-time local setup (Windows PowerShell)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "MI-RA Studio - local setup" -ForegroundColor Cyan

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "Created .env from .env.example - edit DATABASE_URL with your Supabase DB password"
}

if (-not (Test-Path "frontend\.env.local")) {
    Copy-Item "frontend\.env.example" "frontend\.env.local"
    Write-Host "Created frontend\.env.local"
}

New-Item -ItemType Directory -Force -Path "data" | Out-Null

if (-not (Test-Path "backend\.venv")) {
    Write-Host "Creating Python virtual environment..."
    python -m venv backend\.venv
}

Write-Host "Installing backend dependencies..."
& "backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
& "backend\.venv\Scripts\pip.exe" install -r backend\requirements-core.txt

Write-Host "Installing frontend dependencies..."
Set-Location frontend
npm install
Set-Location $Root

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Edit .env - set YOUR_DB_PASSWORD in DATABASE_URL (Supabase Settings > Database)"
Write-Host "2. Run scripts\setup-supabase.sql in Supabase SQL Editor"
Write-Host "3. Start Redis locally (Memurai or WSL redis-server)"
Write-Host "4. .\scripts\dev-backend.ps1"
Write-Host "5. .\scripts\dev-frontend.ps1  (new terminal)"
Write-Host "6. Optional: .\scripts\dev-worker.ps1  (new terminal, needs Redis)"
