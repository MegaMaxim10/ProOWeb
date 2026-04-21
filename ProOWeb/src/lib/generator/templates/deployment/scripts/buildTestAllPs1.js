function buildTestAllPs1() {
  return `$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Assert-CommandExists([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Commande requise non trouvee: $name"
  }
}

Push-Location $root
try {
  Assert-CommandExists "mvn"
  Assert-CommandExists "npm"

  Push-Location "src/backend/springboot"
  mvn test
  Pop-Location

  Push-Location "src/frontend/web/react"
  npm run test --if-present
  Pop-Location

  Write-Host "Tests termines." -ForegroundColor Green
}
finally {
  Pop-Location
}
`;
}

module.exports = {
  buildTestAllPs1,
};
