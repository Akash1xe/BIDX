FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY api-gateway/package.json api-gateway/

RUN npm install --workspace api-gateway --omit=dev

COPY shared ./shared
COPY api-gateway ./api-gateway

EXPOSE 4000

USER node

CMD ["node", "api-gateway/src/server.js"]
