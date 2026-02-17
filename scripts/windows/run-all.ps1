$ErrorActionPreference = 'Continue'

function New-LogPath {
  param([string]$Prefix)
  $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
  $dir = Join-Path $PSScriptRoot '..\..\logs'
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
  return Join-Path $dir "$Prefix-$ts.log"
}

Write-Host "[run-all] Cleaning ports..."
powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'kill-ports.ps1')

$backendLog = New-LogPath 'backend'
$frontendLog = New-LogPath 'frontend'

Write-Host "[run-all] Starting backend (logging to $backendLog)"
Start-Process powershell -ArgumentList "-NoLogo -NoProfile -Command cd ..\..\backend; npm install; npm run dev *>&1 | Tee-Object -FilePath `"$backendLog`"" -WindowStyle Minimized

Start-Sleep -Seconds 5
Write-Host "[run-all] Probing backend health..."
try {
  $ok = (Invoke-WebRequest http://localhost:3001/health -UseBasicParsing -TimeoutSec 10).StatusCode -eq 200
  if (-not $ok) { Write-Host "[run-all] Backend health not OK yet" }
} catch { Write-Host "[run-all] Health probe failed: $($_.Exception.Message)" }

Write-Host "[run-all] Starting frontend (logging to $frontendLog)"
Start-Process powershell -ArgumentList "-NoLogo -NoProfile -Command cd ..\..\frontend; npm install; npm run dev *>&1 | Tee-Object -FilePath `"$frontendLog`"" -WindowStyle Minimized

Write-Host "[run-all] Backend log: $backendLog"
Write-Host "[run-all] Frontend log: $frontendLog"
Write-Host "[run-all] Done."

