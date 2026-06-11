# Start exactly ONE StepWise backend on :8000.
# Kills any process already holding the port first, so duplicate uvicorn
# instances can never fight over it (the cause of the earlier exit-255 churn).

$ErrorActionPreference = "SilentlyContinue"

Get-NetTCPConnection -LocalPort 8000 -State Listen | ForEach-Object {
    Write-Host "Stopping stale listener on :8000 (PID $($_.OwningProcess))"
    Stop-Process -Id $_.OwningProcess -Force
}
Start-Sleep -Milliseconds 600

$env:PYTHONPATH = $PSScriptRoot
& "$PSScriptRoot\.venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
