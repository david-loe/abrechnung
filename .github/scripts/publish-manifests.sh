#!/usr/bin/env bash
set -euo pipefail

# Validate both inputs before changing any tags in either registry.
digests=()
for arch in amd64 arm64; do
  digest="$(cat "$DIGEST_DIR/$arch.txt")"
  if [[ ! "$digest" =~ ^sha256:[0-9a-f]{64}$ ]]; then
    echo "Invalid $arch digest" >&2
    exit 1
  fi
  digests+=("$digest")
done

for image in "davidloe/abrechnung-$PACKAGE" "ghcr.io/david-loe/abrechnung-$PACKAGE"; do
  mapfile -t tags < <(jq -r --arg image "$image" '.tags[] | select(startswith($image + ":"))' <<< "$META_JSON")
  if [ "${#tags[@]}" -eq 0 ]; then
    echo "No tags generated for $image" >&2
    exit 1
  fi
  tag_args=()
  for tag in "${tags[@]}"; do tag_args+=(--tag "$tag"); done
  docker buildx imagetools create "${tag_args[@]}" "$image@${digests[0]}" "$image@${digests[1]}"
  docker buildx imagetools inspect "${tags[0]}" --raw |
    jq -e '[.manifests[].platform | select(.os == "linux") | .architecture] | sort == ["amd64", "arm64"]'
done
