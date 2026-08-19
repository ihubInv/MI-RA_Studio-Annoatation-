$Root = Split-Path -Parent $PSScriptRoot
Set-Location "$Root\backend"
$env:PYTHONPATH = (Get-Location).Path

if (-not (Test-Path ".venv")) {
    Write-Error "Run scripts\setup-local.ps1 first"
}

Write-Host "Starting Celery worker (requires Redis on 127.0.0.1:6379)" -ForegroundColor Cyan
& ".\.venv\Scripts\celery.exe" -A app.workers.celery_app worker -l info -Q image,video,audio,lidar,embeddings,export,ai
