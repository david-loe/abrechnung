#!/bin/sh
set -eu

: "${VITE_FRONTEND_URL:?VITE_FRONTEND_URL is required}"
: "${VITE_BACKEND_URL:?VITE_BACKEND_URL is required}"

runtime_config="$({
  jq -n \
    --arg mode "production" \
    --arg frontend_url "$VITE_FRONTEND_URL" \
    --arg backend_url "$VITE_BACKEND_URL" \
    --arg public_vapid_key "${VITE_PUBLIC_VAPID_KEY:-}" \
    --arg max_file_size "${VITE_MAX_FILE_SIZE:-16000000}" \
    --arg compression_threshold "${VITE_IMAGE_COMPRESSION_THRESHOLD_PX:-1400}" \
    '{
      MODE: $mode,
      VITE_FRONTEND_URL: $frontend_url,
      VITE_BACKEND_URL: $backend_url,
      VITE_MAX_FILE_SIZE: $max_file_size,
      VITE_IMAGE_COMPRESSION_THRESHOLD_PX: $compression_threshold
    } + if $public_vapid_key == "" then {} else {VITE_PUBLIC_VAPID_KEY: $public_vapid_key} end'
})"

printf 'globalThis.__ABRECHNUNG_ENV__ = %s;\n' "$runtime_config" > /tmp/runtime-config.js
sw_config="$(jq -cn --arg frontend_url "$VITE_FRONTEND_URL" --arg backend_url "$VITE_BACKEND_URL" \
  '{frontendUrl: $frontend_url, backendUrl: $backend_url}')"
sw_config_base64="$(printf '%s' "$sw_config" | base64 | tr -d '\n')"
sed "s|__ABRECHNUNG_SW_CONFIG__|$sw_config_base64|g" /app/dist/sw.js > /tmp/sw.js

exec "$@"
