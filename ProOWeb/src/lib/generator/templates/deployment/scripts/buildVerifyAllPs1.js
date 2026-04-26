function buildVerifyAllPs1() {
  return `$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

function Assert-CommandExists([string]$name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $name"
  }
}

Push-Location $root
try {
  Assert-CommandExists "mvn"
  Assert-CommandExists "npm"

  if (-not (Test-Path "src/backend/springboot/pom.xml")) {
    throw "Spring Boot backend not found in src/backend/springboot."
  }

  if (-not (Test-Path "src/frontend/web/react/package.json")) {
    throw "React frontend not found in src/frontend/web/react."
  }

  Push-Location "src/backend/springboot"
  mvn clean verify
  Pop-Location

  Push-Location "src/frontend/web/react"
  npm install
  npm run test --if-present
  npm run build
  Pop-Location

  $profiles = @("dev", "demo", "test", "preprod", "prod")
  if (Get-Command docker -ErrorAction SilentlyContinue) {
    foreach ($profile in $profiles) {
      $composeFile = Join-Path $root "deployment/docker/docker-compose.$profile.yml"
      if (-not (Test-Path $composeFile)) {
        throw "Missing compose file for profile '$profile': $composeFile"
      }

      docker compose -f $composeFile config | Out-Null
    }
    Write-Host "Docker compose profiles validated: $($profiles -join ', ')." -ForegroundColor Green
  } else {
    Write-Host "Docker not available, skipping compose validation." -ForegroundColor Yellow
  }

  Write-Host "Verification completed successfully." -ForegroundColor Green
}
finally {
  Pop-Location
}
`;
}

module.exports = {
  buildVerifyAllPs1,
};
