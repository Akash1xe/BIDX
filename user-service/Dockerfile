FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY user-service/package.json user-service/

RUN npm install --workspace user-service --omit=dev

COPY shared ./shared
COPY user-service ./user-service

EXPOSE 4001

USER node

CMD ["node", "user-service/src/server.js"]
