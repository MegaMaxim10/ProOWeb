function buildStartProfileSh() {
  return `#!/usr/bin/env bash
set -euo pipefail

PROFILE="\${1:-dev}"
ROOT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$ROOT_DIR/deployment/docker/docker-compose.$PROFILE.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker est requis" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Profil inconnu: $PROFILE" >&2
  exit 1
fi

cd "$ROOT_DIR"
docker compose -f "$COMPOSE_FILE" up --build
`;
}

module.exports = {
  buildStartProfileSh,
};
