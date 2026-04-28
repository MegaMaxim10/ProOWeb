function buildTestAllPs1() {
  return `$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Assert-CommandExists([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Commande requise non trouvee: $name"
  }
}

function Invoke-External([string]$step, [scriptblock]$command) {
  & $command
  if ($LASTEXITCODE -ne 0) {
    throw "$step a echoue (code $LASTEXITCODE)."
  }
}

Push-Location $root
try {
  Assert-CommandExists "mvn"
  Assert-CommandExists "npm"

  Push-Location "src/backend/springboot"
  Invoke-External "Backend tests" { mvn clean verify }
  Pop-Location

  Push-Location "src/frontend/web/react"
  Invoke-External "Frontend tests" { npm run test --if-present }
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
