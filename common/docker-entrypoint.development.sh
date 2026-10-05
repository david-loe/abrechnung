#!/bin/sh
set -eu

if ! (cd /app && sha256sum -c /npm_cache/.dependency-manifests >/dev/null 2>&1); then
  echo "Package manifests differ from the development image. Run: docker compose build $DEPENDENCY_SERVICE" >&2
  exit 1
fi

mkdir -p /app/.dependency-sync
exec 9>/app/.dependency-sync/lock
flock -x 9

# Recover an interrupted directory replacement before checking the marker.
if [ ! -d /app/node_modules ] && [ -d /app/.dependency-sync/old ]; then
  mv /app/.dependency-sync/old /app/node_modules
fi

if ! cmp -s /npm_cache/.dependency-id /app/node_modules/.dependency-id; then
  echo "Synchronizing $DEPENDENCY_SERVICE dependencies"
  rm -rf /app/.dependency-sync/new /app/.dependency-sync/old
  mkdir /app/.dependency-sync/new
  cp -R /npm_cache/node_modules/. /app/.dependency-sync/new/
  cp /npm_cache/.dependency-id /app/.dependency-sync/new/.dependency-id
  if [ -e /app/node_modules ]; then
    mv /app/node_modules /app/.dependency-sync/old
  fi
  if ! mv /app/.dependency-sync/new /app/node_modules; then
    if [ -d /app/.dependency-sync/old ]; then
      mv /app/.dependency-sync/old /app/node_modules
    fi
    exit 1
  fi
fi

# A previous process may have stopped after publishing the new installation.
rm -rf /app/.dependency-sync/new /app/.dependency-sync/old

flock -u 9
exec 9>&-
exec "$@"
