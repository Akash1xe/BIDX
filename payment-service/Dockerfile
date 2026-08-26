FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY payment-service/package.json payment-service/
RUN npm install --workspace payment-service --omit=dev
COPY shared ./shared
COPY payment-service ./payment-service
EXPOSE 4005
USER node
CMD ["node", "payment-service/src/server.js"]
