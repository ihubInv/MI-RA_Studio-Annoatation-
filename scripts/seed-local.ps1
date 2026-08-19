$Root = Split-Path -Parent $PSScriptRoot
Set-Location "$Root\backend"
$env:PYTHONPATH = (Get-Location).Path

& ".\.venv\Scripts\python.exe" "..\scripts\seed.py"
