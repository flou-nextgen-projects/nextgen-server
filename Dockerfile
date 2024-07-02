FROM node:lts-alpine
# ENV NODE_ENV=production
RUN mkdir -p /app
WORKDIR /app
COPY . .
RUN npm install
RUN npm run tsc
EXPOSE 3800
CMD ["npm", "start"]