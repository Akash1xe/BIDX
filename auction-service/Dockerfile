FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY auction-service/package.json auction-service/

RUN npm install --workspace auction-service --omit=dev

COPY shared ./shared
COPY auction-service ./auction-service

EXPOSE 4002

USER node

CMD ["node", "auction-service/src/server.js"]
