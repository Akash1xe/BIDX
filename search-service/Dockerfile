FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY search-service/package.json search-service/

RUN npm install --workspace search-service --omit=dev

COPY shared ./shared
COPY search-service ./search-service

EXPOSE 4003

USER node

CMD ["node", "search-service/src/server.js"]
