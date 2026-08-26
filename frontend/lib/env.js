const DEFAULT_API_URL = "http://localhost:4000/api/v1";
const DEFAULT_SOCKET_URL = "http://localhost:4000";

function withoutTrailingSlash(value) {
  return value.replace(/\/$/, "");
}

export const env = Object.freeze({
  apiUrl: withoutTrailingSlash(
    process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL
  ),
  socketUrl: withoutTrailingSlash(
    process.env.NEXT_PUBLIC_SOCKET_URL || DEFAULT_SOCKET_URL
  ),
  apiTimeoutMs: Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 90_000),
  razorpayKeyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
});

