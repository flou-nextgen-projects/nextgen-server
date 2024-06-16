FROM nginx:latest

WORKDIR /usr/app

# Install required packages
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p /usr/app/shared-volume /usr/app/ssl

# Copy scripts and configs
COPY generate-certs.sh /usr/app/shared-volume/generate-certs.sh
COPY v3.ext /usr/app/shared-volume/v3.ext

# Make the script executable
RUN chmod +x /usr/app/shared-volume/generate-certs.sh

# Copy nginx config and html
COPY nginx.conf /etc/nginx/
COPY html/* /etc/nginx/html/

ENTRYPOINT ["/usr/app/shared-volume/generate-certs.sh"]
