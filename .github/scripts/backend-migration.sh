#!/usr/bin/env bash
set -euo pipefail

# Both releases use the same Compose project, services and database volume.
cat > "$RUNNER_TEMP/previous-release.yml" <<'EOF'
services:
  backend:
    image: davidloe/abrechnung-backend:${PREVIOUS_VERSION}
EOF
cat > "$RUNNER_TEMP/current-release.yml" <<'EOF'
services:
  backend:
    image: ${BACKEND_IMAGE:-abrechnung-backend}
    pull_policy: never
EOF

docker compose -f deploy-compose.yml -f "$RUNNER_TEMP/previous-release.yml" run --rm backend npm run setup
docker compose -f deploy-compose.yml -f "$RUNNER_TEMP/current-release.yml" run --rm --no-deps backend node dist/setup.js
