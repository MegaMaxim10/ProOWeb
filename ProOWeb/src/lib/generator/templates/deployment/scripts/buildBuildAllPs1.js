function buildBuildAllPs1() {
  return `$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Assert-CommandExists([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Commande requise non trouvee: $name"
  }
}

Push-Location $root
try {
  if (-not (Test-Path "src/backend/springboot/pom.xml")) {
    throw "Backend Spring Boot introuvable. Regenerer le workspace via ProOWeb."
  }

  if (-not (Test-Path "src/frontend/web/react/package.json")) {
    throw "Frontend React introuvable. Regenerer le workspace via ProOWeb."
  }

  Assert-CommandExists "mvn"
  Assert-CommandExists "npm"

  Push-Location "src/backend/springboot"
  mvn clean package -DskipTests
  Pop-Location

  Push-Location "src/frontend/web/react"
  npm install
  npm run build
  Pop-Location

  Write-Host "Build termine avec succes." -ForegroundColor Green
}
finally {
  Pop-Location
}
`;
}

module.exports = {
  buildBuildAllPs1,
};
