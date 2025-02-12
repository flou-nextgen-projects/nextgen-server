FROM node:lts-alpine

# Install dependencies (openssl, bash, sed)
RUN apk add --no-cache openssl bash sed

# Create app directory
WORKDIR /app

# Copy files
COPY . .

# Specifically copy generate-certs.sh
COPY generate-certs.sh /app/generate-certs.sh

# Fix Windows line endings and make script executable
RUN sed -i 's/\r$//' /app/generate-certs.sh && chmod +x /app/generate-certs.sh

# Run certificate generation script
RUN /bin/bash /app/generate-certs.sh

# Install Node.js dependencies
RUN npm install

# install typescript globally
RUN npm install -g typescript

# Compile TypeScript if needed
RUN npm run tsc

# Expose ports
EXPOSE 9000 9229

# Start the Node.js application
CMD ["npm", "start"]
