const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const logger = require("@bidx/shared/utils/logger");

function verifyHandshake(socket, next) {
  const token =
    socket.handshake.auth?.token ||
    (socket.handshake.headers?.authorization || "").replace(/^Bearer\s+/i, "");

  if (!token) {
    return next(new Error("unauthorized: missing token"));
  }

  try {
    const payload = jwt.verify(token, env.jwt.accessSecret, { issuer: "bidx.user-service" });
    socket.data.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role
    };
    return next();
  } catch {
    return next(new Error("unauthorized: invalid token"));
  }
}

function initSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    path: "/socket.io"
  });

  io.use(verifyHandshake);

  io.on("connection", (socket) => {
    const userId = socket.data.user.id;
    logger.info(`Socket connected user=${userId} sid=${socket.id}`);
    socket.join(`user:${userId}`);

    socket.on("auction:join", (auctionId, ack) => {
      if (typeof auctionId !== "string" || auctionId.length < 12) {
        if (typeof ack === "function") ack({ error: "invalid auctionId" });
        return;
      }
      socket.join(`auction:${auctionId}`);
      if (typeof ack === "function") ack({ joined: `auction:${auctionId}` });
    });

    socket.on("auction:leave", (auctionId) => {
      if (typeof auctionId === "string") {
        socket.leave(`auction:${auctionId}`);
      }
    });

    socket.on("disconnect", () => {
      logger.info(`Socket disconnected user=${userId} sid=${socket.id}`);
    });
  });

  return io;
}

module.exports = { initSocket };
