$Root = Split-Path -Parent $PSScriptRoot
Set-Location "$Root\backend"
$env:PYTHONPATH = (Get-Location).Path

if (-not (Test-Path ".venv\Scripts\alembic.exe")) {
    Write-Error "Run scripts\setup-local.ps1 first"
}

Write-Host "Running Alembic migrations against Supabase..." -ForegroundColor Cyan
& ".\.venv\Scripts\alembic.exe" upgrade head
