$Root = Split-Path -Parent $PSScriptRoot
Set-Location "$Root\backend"
$env:PYTHONPATH = (Get-Location).Path

if (-not (Test-Path ".venv")) {
    Write-Error "Run scripts\setup-local.ps1 first"
}

Write-Host "Starting MI-RA Studio API on http://127.0.0.1:8000" -ForegroundColor Cyan
& ".\.venv\Scripts\python.exe" run.py
