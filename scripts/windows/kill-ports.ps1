param(
  [int[]]$Ports = @(3001,3000)
)
$ErrorActionPreference = 'SilentlyContinue'
Write-Host "[kill-ports] Checking ports: $($Ports -join ', ')"
foreach ($p in $Ports) {
  $lines = (netstat -ano | Select-String ":$p" | Select-String "LISTENING")
  foreach ($l in $lines) {
    $procId = ($l.ToString().Trim() -split '\s+')[-1]
    if ($procId -match '^[0-9]+$') {
      Write-Host "[kill-ports] Killing PID $procId on port $p"
      taskkill /F /PID $procId | Out-Null
    }
  }
}
Write-Host "[kill-ports] Done."

