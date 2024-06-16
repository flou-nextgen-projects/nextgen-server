#!/bin/sh

set -e
CERTROOT="/usr/app/shared-volume"
PEMROOT=/usr/app/ssl
NGINXROOT=/etc/nginx/ssl
# Generate certificates
openssl req -new -newkey rsa:4096 -sha256 -nodes -keyout "$CERTROOT/device.key" -out "$CERTROOT/device.csr" -subj "/C=IN/ST=Maharashtra/L=Pune/O=NjSOft/OU=Software/CN=localhost"
openssl x509 -req -in $CERTROOT/device.csr -CA $PEMROOT/rootCA.pem -CAkey $PEMROOT/rootCA.key -CAcreateserial -out $CERTROOT/device.crt -days 2048 -sha256 -extfile $CERTROOT/v3.ext

mkdir -p $NGINXROOT
# Copy certificates to nginx ssl directory
cp $CERTROOT/device.crt $NGINXROOT/device.crt
cp $CERTROOT/device.key $NGINXROOT/device.key

echo "Self signed SSL Certificates generated successfully... starting nginx server..."

nginx -g "daemon off;"
