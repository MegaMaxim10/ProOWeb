function buildStartProfilePs1() {
  return `param(
  [string]$Profile = "dev"
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker est requis pour lancer les profils de deploiement."
}

$composeFile = Join-Path $root "deployment/docker/docker-compose.$Profile.yml"
if (-not (Test-Path $composeFile)) {
  throw "Profil inconnu: $Profile. Fichier attendu: $composeFile"
}

Push-Location $root
try {
  docker compose -f $composeFile up --build
}
finally {
  Pop-Location
}
`;
}

module.exports = {
  buildStartProfilePs1,
};
