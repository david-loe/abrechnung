#!/usr/bin/env bash
set -euo pipefail
FRONTEND_IMAGE="${FRONTEND_IMAGE:-abrechnung-frontend}"
cleanup() { docker rm -f frontend-smoke-a frontend-smoke-b >/dev/null 2>&1 || true; }
trap cleanup EXIT
image_id="$(docker image inspect "$FRONTEND_IMAGE" --format '{{.Id}}')"
docker run -d --name frontend-smoke-a -p 18080:8080 \
  -e VITE_FRONTEND_URL=http://localhost:18080 -e VITE_BACKEND_URL=http://backend-a.test "$FRONTEND_IMAGE"
docker run -d --name frontend-smoke-b -p 18081:8080 \
  -e VITE_FRONTEND_URL=http://localhost:18081 -e VITE_BACKEND_URL=http://backend-b.test "$FRONTEND_IMAGE"
for port in 18080 18081; do
  for _ in {1..30}; do curl --fail --silent "http://127.0.0.1:${port}/" >/dev/null && break; sleep 1; done
done
test "$(docker inspect frontend-smoke-a --format '{{.Image}}')" = "$image_id"
test "$(docker inspect frontend-smoke-b --format '{{.Image}}')" = "$image_id"
curl --fail --silent http://127.0.0.1:18080/runtime-config.js | grep -q 'http://backend-a.test'
curl --fail --silent http://127.0.0.1:18081/runtime-config.js | grep -q 'http://backend-b.test'
curl --fail --silent --head http://127.0.0.1:18080/runtime-config.js | grep -qi 'cache-control: no-store'
