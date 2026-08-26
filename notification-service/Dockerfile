FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
COPY shared/package.json shared/
COPY notification-service/package.json notification-service/
RUN npm install --workspace notification-service --omit=dev
COPY shared ./shared
COPY notification-service ./notification-service
EXPOSE 4006
USER node
CMD ["node", "notification-service/src/server.js"]
