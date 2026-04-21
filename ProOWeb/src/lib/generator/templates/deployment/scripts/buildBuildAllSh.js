function buildBuildAllSh() {
  return `#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"

cd "$ROOT_DIR"

if ! command -v mvn >/dev/null 2>&1; then
  echo "mvn est requis" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm est requis" >&2
  exit 1
fi

cd "$ROOT_DIR/src/backend/springboot"
mvn clean package -DskipTests

cd "$ROOT_DIR/src/frontend/web/react"
npm install
npm run build

echo "Build termine avec succes."
`;
}

module.exports = {
  buildBuildAllSh,
};
