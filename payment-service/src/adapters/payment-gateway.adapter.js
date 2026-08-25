const crypto = require("crypto");
const env = require("../config/env");
const logger = require("@bidx/shared/utils/logger");

class PaymentGatewayAdapter {
  constructor({ mode, keyId, keySecret, webhookSecret, apiUrl }) {
    this.mode = mode;
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
    this.apiUrl = apiUrl;
  }

  hmac(secret, payload) {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  }

  verifyWebhookSignature(rawBody, signature) {
    if (!rawBody || !signature) {
      return false;
    }
    const expected = this.hmac(this.webhookSecret, rawBody);
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  verifyCheckoutSignature(orderId, paymentId, signature) {
    if (!orderId || !paymentId || !signature) {
      return false;
    }
    const expected = this.hmac(this.keySecret, `${orderId}|${paymentId}`);
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  signCheckout(orderId, paymentId) {
    return this.hmac(this.keySecret, `${orderId}|${paymentId}`);
  }

  async createOrder({ amountMinor, currency = "INR", receipt }) {
    if (this.mode === "live") {
      return this.createLiveOrder({ amountMinor, currency, receipt });
    }
    return {
      id: `order_dev_${crypto.randomBytes(8).toString("hex")}`,
      amount: amountMinor,
      currency,
      receipt,
      status: "created",
      mode: "dev"
    };
  }

  async createLiveOrder({ amountMinor, currency, receipt }) {
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    let res;
    try {
      res = await fetch(`${this.apiUrl}/orders`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: amountMinor,
          currency,
          receipt,
          payment_capture: 1
        })
      });
    } catch (err) {
      throw new Error(`Razorpay order request failed: ${err.message}`);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(`Razorpay order rejected (${res.status}): ${json.error?.description || "unknown"}`);
    }
    return { ...json, mode: "live" };
  }
}

function selectGateway() {
  const adapter = new PaymentGatewayAdapter(env.gateway);
  logger.info(`Payment gateway in ${adapter.mode.toUpperCase()} mode`);
  return adapter;
}

module.exports = { PaymentGatewayAdapter, selectGateway };
