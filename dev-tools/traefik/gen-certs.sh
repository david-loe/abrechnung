#!/bin/sh

# Verzeichnis für Zertifikate erstellen
mkdir -p /certificates

# Generiere den privaten Schlüssel
openssl genrsa -out /certificates/abrechnung.key 2048

# Generiere ein selbstsigniertes Zertifikat
openssl req -new -x509 -nodes -sha256 -days 3650 \
  -key /certificates/abrechnung.key \
  -out /certificates/abrechnung.crt \
  -subj "/C=DE/ST=State/L=City/O=Company/OU=Department/CN=${TLS_CERT_CN}"

# Starte Traefik
exec traefik "$@"
