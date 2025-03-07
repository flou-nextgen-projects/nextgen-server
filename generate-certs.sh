#!/bin/bash

set -e  # Exit script on error
set -o pipefail  # Ensure errors in pipelines are caught

CERT_ROOT=/app/out
PEM_ROOT=/app/certs
APP_DIR=/app
DIST_DIR=$APP_DIR/dist/certificates

# Ensure required root CA files exist
if [[ ! -f "$PEM_ROOT/rootCA.pem" || ! -f "$PEM_ROOT/rootCA.key" ]]; then
  echo "Error: Missing root CA files (rootCA.pem or rootCA.key) in $PEM_ROOT"
  exit 1
fi

# Create necessary directories
mkdir -p "$CERT_ROOT" "$DIST_DIR"
chmod 755 "$CERT_ROOT" "$DIST_DIR"

# Generate device key and CSR
openssl req -new -newkey rsa:4096 -sha256 -nodes \
  -keyout "$CERT_ROOT/device.key" \
  -out "$CERT_ROOT/device.csr" \
  -subj "/C=IN/ST=Maharashtra/L=Pune/O=BlueDrop/OU=Software/CN=localhost"

# Generate device certificate
openssl x509 -req -in "$CERT_ROOT/device.csr" \
  -CA "$PEM_ROOT/rootCA.pem" -CAkey "$PEM_ROOT/rootCA.key" \
  -CAcreateserial -CAserial /tmp/rootCA.srl \
  -out "$CERT_ROOT/device.crt" -days 2048 -sha256 \
  -extfile "$PEM_ROOT/v3.ext"

# Ensure the certificate is in PEM format
cp "$CERT_ROOT/device.crt" "$CERT_ROOT/device.pem"

# Generate MongoDB server key and certificate
openssl req -new -nodes -x509 -days 365 \
  -keyout "$CERT_ROOT/mongodb-server.key" \
  -out "$CERT_ROOT/mongodb-server.crt" \
  -subj "/CN=localhost" -config "$PEM_ROOT/v3.ext"

# Generate PKCS#12 format MongoDB certificate
openssl pkcs12 -export -out "$CERT_ROOT/mongodb-server.pfx" \
  -inkey "$CERT_ROOT/mongodb-server.key" \
  -in "$CERT_ROOT/mongodb-server.crt" \
  -certfile "$PEM_ROOT/rootCA.pem" -passout pass:

# Copy certificates to distribution directory
cp "$CERT_ROOT/device.crt" "$DIST_DIR/device.crt"
cp "$CERT_ROOT/device.key" "$DIST_DIR/device.key"
cp "$PEM_ROOT/rootCA.pem" "$DIST_DIR/rootCA.pem"
cp "$CERT_ROOT/mongodb-server.crt" "$DIST_DIR/mongodb-server.crt"
cp "$CERT_ROOT/mongodb-server.key" "$DIST_DIR/mongodb-server.key"
cp "$CERT_ROOT/mongodb-server.pfx" "$DIST_DIR/mongodb-server.pfx"

# Create MongoDB certificate files
cat "$CERT_ROOT/device.crt" "$CERT_ROOT/device.key" > "$DIST_DIR/mongodb-server.pem"
cat "$CERT_ROOT/device.crt" "$CERT_ROOT/device.key" > "$DIST_DIR/mongodb-client.pem"

# Set appropriate permissions
chmod 644 "$DIST_DIR"/*

# Cleanup: Remove temporary certificate files
rm -rf "$CERT_ROOT"

echo "Certificate generation completed successfully."

# Start MongoDB with SSL
echo "Starting MongoDB instance with SSL..."