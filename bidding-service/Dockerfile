FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY bidding-service/package.json bidding-service/

RUN npm install --workspace bidding-service --omit=dev

COPY shared ./shared
COPY bidding-service ./bidding-service

EXPOSE 4004

USER node

CMD ["node", "bidding-service/src/server.js"]
