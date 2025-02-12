# Use the official MongoDB image
FROM mongo:latest

# Copy the MongoDB configuration file
COPY mongod.conf /etc/mongod.conf

RUN mkdir -p /mongodb/database

RUN chown -R mongodb:mongodb /mongodb/database
RUN chmod -R 755 /mongodb/database

# Expose the MongoDB port
EXPOSE 27017

# Run MongoDB as a daemon in the background
CMD ["mongod", "--config", "/etc/mongod.conf"]
