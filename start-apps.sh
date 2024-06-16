#!/bin/sh

set -e
CERTROOT="/usr/app/shared-volume"
PEMROOT=/usr/app/ssl
APP=/usr/app/dist/certificates

if [ ! -w "$CERTROOT" ]; then
    echo "Setting write permissions for $CERTROOT"
    chown -R node:node "$CERTROOT"
    chmod -R 755 "$CERTROOT"
fi

# Generate certificates
openssl req -new -newkey rsa:4096 -sha256 -nodes -keyout "$CERTROOT/device.key" -out "$CERTROOT/device.csr" -subj "/C=IN/ST=Maharashtra/L=Pune/O=NjSOft/OU=Software/CN=localhost"
openssl x509 -req -in $CERTROOT/device.csr -CA $PEMROOT/rootCA.pem -CAkey $PEMROOT/rootCA.key -CAcreateserial -out $CERTROOT/device.crt -days 2048 -sha256 -extfile $CERTROOT/v3.ext

mkdir -p $APP
cp $CERTROOT/device.crt $APP/device.crt
cp $CERTROOT/device.key $APP/device.key

echo "==================================================================================="
echo "Start typescript server (watch mode), babel (watch mode) and nodemon(watch mode)."
echo "==================================================================================="

npm install nodemon;

npm run bash-tsc & npm run watch-node;

wait