FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY admin-service/package.json admin-service/
RUN npm install --workspace admin-service --omit=dev
COPY shared ./shared
COPY admin-service ./admin-service
EXPOSE 4007
USER node
CMD ["node", "admin-service/src/server.js"]
