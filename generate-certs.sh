#!/bin/bash

CERT_ROOT=/app/out
PEM_ROOT=/app/certs
APP_DIR=/app
mkdir -p $CERT_ROOT
chmod +x $CERT_ROOT
chmod +x $PEM_ROOT
# generate device key and CSR
openssl req -new -newkey rsa:4096 -sha256 -nodes -keyout $CERT_ROOT/device.key -out $CERT_ROOT/device.csr -subj "/C=IN/ST=Maharashtra/L=Pune/O=BlueDrop/OU=Software/CN=localhost"
# generate device certificate
openssl x509 -req -in $CERT_ROOT/device.csr -CA $PEM_ROOT/rootCA.pem -CAkey $PEM_ROOT/rootCA.key -CAcreateserial -CAserial /tmp/rootCA.srl -out $CERT_ROOT/device.crt -days 2048 -sha256 -extfile $PEM_ROOT/v3.ext
# ensure the certificate is in PEM format (it already is, but we'll rename for clarity)
cp $CERT_ROOT/device.crt $CERT_ROOT/device.pem
# create directory for nginx SSL files
mkdir -p $CERT_ROOT/dist/certificates
mkdir -p $APP_DIR/dist/certificates
chmod +x $APP_DIR/dist/certificates
# verify directory creation
if [ ! -d "$APP_DIR/dist/certificates" ]; then
  echo "Failed to create directory: $APP_DIR/dist/certificates"
  exit 1
fi
# copy certificates to nginx SSL directory
cp $CERT_ROOT/device.crt $APP_DIR/dist/certificates/device.crt
cp $CERT_ROOT/device.key $APP_DIR/dist/certificates/device.key
cp $PEM_ROOT/rootCA.pem $APP_DIR/dist/certificates/rootCA.pem
cat $CERT_ROOT/device.crt $CERT_ROOT/device.key > $APP_DIR/dist/certificates/mongodb-server.pem
cat $CERT_ROOT/device.crt $CERT_ROOT/device.key > $APP_DIR/dist/certificates/mongodb-client.pem
# remove generated certificates
rm -r $CERT_ROOT
echo "Certificate generation completed."