# Stage 1: Build
FROM node:lts-alpine as builder
WORKDIR /usr/app

# Copy package.json and install dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Make the start script executable
COPY start-apps.sh /usr/app/start-apps.sh
RUN chmod +x /usr/app/start-apps.sh

# Ensure the dist directory exists and has the correct permissions
RUN mkdir -p /usr/app/dist /usr/app/shared-volume
RUN chmod 755 /usr/app/dist /usr/app/shared-volume
COPY v3.ext /usr/app/shared-volume/v3.ext

# Stage 2: Production
FROM node:lts-alpine
WORKDIR /usr/app

# Install openssl using apk
RUN apk update && apk add --no-cache openssl

# Copy the built files from the builder stage
COPY --from=builder /usr/app /usr/app

# Ensure the shared-volume directory exists and has the correct permissions
RUN mkdir -p /usr/app/shared-volume
RUN chown -R node:node /usr/app/dist /usr/app/shared-volume

# Switch to non-root user
# USER node

# Start the application
ENTRYPOINT ["/usr/app/start-apps.sh"]
