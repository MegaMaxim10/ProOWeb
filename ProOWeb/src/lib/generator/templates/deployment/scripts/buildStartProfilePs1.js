function buildStartProfilePs1() {
  return `param(
  [string]$Profile = "dev"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker est requis pour lancer les profils de deploiement."
}

function Invoke-External([string]$step, [scriptblock]$command) {
  & $command
  if ($LASTEXITCODE -ne 0) {
    throw "$step a echoue (code $LASTEXITCODE)."
  }
}

$composeFile = Join-Path $root "deployment/docker/docker-compose.$Profile.yml"
if (-not (Test-Path $composeFile)) {
  throw "Profil inconnu: $Profile. Fichier attendu: $composeFile"
}

Push-Location $root
try {
  Invoke-External "Demarrage du profil $Profile" { docker compose -f $composeFile up --build }
}
finally {
  Pop-Location
}
`;
}

module.exports = {
  buildStartProfilePs1,
};
