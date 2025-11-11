#!/bin/sh
set -e
cp -r /npm_cache/node_modules/. /app/node_modules
exec "$@"
