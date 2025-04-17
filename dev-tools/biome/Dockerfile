ARG BIOME_VERSION=1.9.4

FROM ghcr.io/biomejs/biome:${BIOME_VERSION}

# Install git and flag to repo safe
RUN apk add --no-cache git
RUN git config --global --add safe.directory /code