Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is required to run backend tests."
}

$extraArgs = $args -join " "
if ([string]::IsNullOrWhiteSpace($extraArgs)) {
  $extraArgs = "tests"
}

Write-Host "Running backend tests in Docker Compose..."
docker compose run --rm backend sh -lc "python -m pytest -q $extraArgs"
