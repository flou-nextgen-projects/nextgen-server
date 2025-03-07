# Use the official MongoDB image
FROM mongo:latest

# Copy the MongoDB configuration file
COPY mongod.conf /etc/mongod.conf

RUN mkdir -p /mongodb/database

RUN chown -R mongodb:mongodb /mongodb/database
RUN chmod -R 755 /mongodb/database

COPY ./certs /app/certs

RUN ls -a /app/certs
# Specifically copy generate-certs.sh
COPY generate-certs.sh /app/generate-certs.sh

# Fix Windows line endings and make script executable
RUN sed -i 's/\r$//' /app/generate-certs.sh && chmod +x /app/generate-certs.sh

# Run certificate generation script
RUN /bin/bash /app/generate-certs.sh

# Expose the MongoDB port
EXPOSE 27000

# Run MongoDB as a daemon in the background
CMD ["mongod", "--config", "/etc/mongod.conf"]
