FROM traefik:v3.0

# Installiere OpenSSH auf einem Alpine-basierten Image
RUN apk update && apk add --no-cache openssl

# Kopiere das Skript in das Container-Image
COPY gen-certs.sh /

# Mache das Skript ausführbar
RUN chmod +x /gen-certs.sh

# Setze das Skript als Entrypoint
ENTRYPOINT ["/gen-certs.sh"]

# Setze Standardbefehle
CMD ["traefik"]