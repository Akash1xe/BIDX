import { io } from "socket.io-client";
import { env } from "@/lib/env";

export function createBidSocket(accessToken) {
  return io(env.socketUrl, {
    path: "/socket.io",
    auth: { token: accessToken },
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 8_000,
  });
}

