param(
  [int]$BackendPort = 8000,
  [int]$FrontendPort = 5173
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$python = Join-Path $backend ".venv\Scripts\python.exe"

if (!(Test-Path -LiteralPath $python)) {
  throw "Backend virtual environment not found at $python. Create it before running the demo launcher."
}

if (!(Test-Path -LiteralPath (Join-Path $backend ".env"))) {
  throw "Missing backend\.env. Add OPENAI_API_KEY there before running the AI-enabled demo."
}

function Stop-PortProcess {
  param([int]$Port)

  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    $processId = $connection.OwningProcess
    if ($processId -and $processId -ne $PID) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

Stop-PortProcess -Port $BackendPort
Stop-PortProcess -Port $FrontendPort

Start-Process -FilePath $python `
  -ArgumentList "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "$BackendPort" `
  -WorkingDirectory $backend `
  -WindowStyle Hidden

Start-Sleep -Seconds 2

Start-Process -FilePath "npm.cmd" `
  -ArgumentList "run", "dev", "--", "--host", "127.0.0.1", "--port", "$FrontendPort", "--strictPort" `
  -WorkingDirectory $frontend `
  -WindowStyle Hidden

Start-Sleep -Seconds 3

Write-Host "QCP GST F5 backend:  http://127.0.0.1:$BackendPort"
Write-Host "QCP GST F5 frontend: http://127.0.0.1:$FrontendPort"
Write-Host "AI status:           http://127.0.0.1:$BackendPort/ai/status"
