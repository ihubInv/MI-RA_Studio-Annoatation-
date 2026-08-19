$Root = Split-Path -Parent $PSScriptRoot
Set-Location "$Root\frontend"

Write-Host "Starting MI-RA Studio UI on http://localhost:5173" -ForegroundColor Cyan
npm run dev
