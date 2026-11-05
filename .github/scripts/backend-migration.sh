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

# Setup must prepare authentication indexes before a server is started.
docker compose -f deploy-compose.yml -f "$RUNNER_TEMP/current-release.yml" run --rm --no-deps backend node --input-type=module -e '
import { MongoClient } from "mongodb"
const client = new MongoClient(process.env.MONGO_URL)
try {
  await client.connect()
  const db = client.db()
  const credentials = await db.collection("passkeys").indexes()
  const challenges = await db.collection("passkeychallenges").indexes()
  if (!credentials.some(index => index.unique && index.key.credentialId === 1)) {
    throw new Error("Passkey credential uniqueness index missing after setup")
  }
  if (!challenges.some(index => index.expireAfterSeconds === 0 && index.key.expiresAt === 1)) {
    throw new Error("Passkey challenge expiration index missing after setup")
  }
  console.log("Passkey indexes verified after standalone setup")
} finally {
  await client.close()
}
'
