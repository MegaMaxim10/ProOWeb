function buildVerifyAllSh() {
  return `#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

assert_command_exists() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Required command not found: $command_name" >&2
    exit 1
  fi
}

cd "$ROOT_DIR"

assert_command_exists mvn
assert_command_exists npm

if [[ ! -f "$ROOT_DIR/src/backend/springboot/pom.xml" ]]; then
  echo "Spring Boot backend not found in src/backend/springboot." >&2
  exit 1
fi

if [[ ! -f "$ROOT_DIR/src/frontend/web/react/package.json" ]]; then
  echo "React frontend not found in src/frontend/web/react." >&2
  exit 1
fi

cd "$ROOT_DIR/src/backend/springboot"
mvn clean verify

cd "$ROOT_DIR/src/frontend/web/react"
npm install
npm run test --if-present
npm run test:e2e:ci --if-present
npm run build

profiles=(dev demo test preprod prod)
if command -v docker >/dev/null 2>&1; then
  for profile in "\${profiles[@]}"; do
    compose_file="$ROOT_DIR/deployment/docker/docker-compose.$profile.yml"
    if [[ ! -f "$compose_file" ]]; then
      echo "Missing compose file for profile '$profile': $compose_file" >&2
      exit 1
    fi

    docker compose -f "$compose_file" config >/dev/null
  done
  echo "Docker compose profiles validated: \${profiles[*]}."
else
  echo "Docker not available, skipping compose validation."
fi

echo "Verification completed successfully."
`;
}

module.exports = {
  buildVerifyAllSh,
};
