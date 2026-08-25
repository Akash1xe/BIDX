const { ApiError, KAFKA_TOPICS } = require("@bidx/shared");
const publisher = require("@bidx/shared/kafka/producer");
const logger = require("@bidx/shared/utils/logger");
const env = require("../config/env");
const db = require("../config/db");
const { PAYMENT_STATUS, paymentSchema } = require("../models/payment.model");
const { auctionWinnerSchema } = require("../models/auction-winner.model");
const { selectGateway } = require("../adapters/payment-gateway.adapter");

const gateway = selectGateway();

async function safePublish(topic, data, key) {
  try {
    await publisher.publish(topic, data, { key });
  } catch (err) {
    logger.error(`Event publish failed for ${topic}: ${err.message}`);
  }
}

function models() {
  const connection = db.get("payments");
  return {
    Payment: paymentSchema(connection),
    AuctionWinner: auctionWinnerSchema(connection)
  };
}

class PaymentService {
  async createOrder(user, auctionId) {
    const { Payment, AuctionWinner } = models();

    const win = await AuctionWinner.findOne({ auctionId });
    if (!win || win.winnerId !== user.id) {
      throw ApiError.notFound("No won auction found for this user and auction");
    }

    const existing = await Payment.findOne({
      auctionId,
      status: { $in: [PAYMENT_STATUS.CREATED, PAYMENT_STATUS.PAID] }
    });
    if (existing) {
      if (existing.status === PAYMENT_STATUS.PAID) {
        throw ApiError.conflict("Auction has already been paid");
      }
      return { ...existing.toPublic(), replayed: true };
    }

    const order = await gateway.createOrder({
      amountMinor: win.finalPrice * 100,
      currency: "INR",
      receipt: `rcpt_${auctionId}`
    });

    const payment = await Payment.create({
      auctionId,
      winnerId: win.winnerId,
      sellerId: win.sellerId,
      amountMinor: order.amount,
      currency: order.currency || "INR",
      orderId: order.id,
      status: PAYMENT_STATUS.CREATED,
      mode: gateway.mode
    });

    await safePublish(
      KAFKA_TOPICS.PAYMENT_CREATED,
      {
        paymentId: payment._id.toString(),
        auctionId,
        winnerId: payment.winnerId,
        sellerId: payment.sellerId,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        orderId: payment.orderId,
        mode: payment.mode
      },
      auctionId
    );

    return { ...payment.toPublic(), keyIdForCheckout: gateway.mode === "live" ? gateway.keyId : null, replayed: false };
  }

  async confirmCheckout(user, { orderId, paymentId, signature }) {
    const { Payment } = models();

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      throw ApiError.notFound("Order not found");
    }
    if (payment.winnerId !== user.id) {
      throw ApiError.forbidden("You are not the winner on this order");
    }

    if (!gateway.verifyCheckoutSignature(orderId, paymentId, signature)) {
      throw ApiError.badRequest("Invalid checkout signature");
    }

    return this.markPaid(payment, { providerPaymentId: paymentId, source: "checkout" });
  }

  async handleWebhook(rawBody, signature) {
    const { Payment } = models();

    if (!gateway.verifyWebhookSignature(rawBody, signature)) {
      throw ApiError.unauthorized("Invalid webhook signature");
    }

    let event;
    try {
      event = JSON.parse(rawBody);
    } catch {
      throw ApiError.badRequest("Webhook body must be valid JSON");
    }

    const eventId =
      event.id ||
      `${event.event}:${event?.payload?.payment?.entity?.id || event?.payload?.order?.entity?.id || ""}`;
    const type = event.event;
    const entity = event.payload?.payment?.entity;

    if (type === "payment.captured" || type === "order.paid" || type === "payment.authorized") {
      const payment = entity ? await Payment.findOne({ orderId: entity.order_id }) : null;
      if (!payment) {
        logger.warn(`Webhook ${type} for unknown order ${entity?.order_id}`);
        return { received: true, matched: false };
      }
      await this.markPaid(payment, {
        providerPaymentId: entity.id,
        source: "webhook",
        eventId
      });
      return { received: true, matched: true };
    }

    if (type === "payment.failed") {
      const payment = entity ? await Payment.findOne({ orderId: entity.order_id }) : null;
      if (payment && payment.status === PAYMENT_STATUS.CREATED) {
        payment.status = PAYMENT_STATUS.FAILED;
        payment.paymentId = entity.id || null;
        this.noteEvent(payment, eventId);
        await payment.save();
        await safePublish(
          KAFKA_TOPICS.PAYMENT_FAILED,
          {
            paymentId: payment._id.toString(),
            auctionId: payment.auctionId,
            orderId: payment.orderId,
            winnerId: payment.winnerId,
            reason: entity.error_description || "gateway reported failure"
          },
          payment.auctionId
        );
      }
      return { received: true, matched: Boolean(payment) };
    }

    return { received: true, matched: false };
  }

  noteEvent(payment, eventId) {
    if (eventId && !payment.providerEventIds.includes(eventId)) {
      payment.providerEventIds.push(eventId);
    }
  }

  async markPaid(payment, { providerPaymentId, source, eventId }) {
    if (payment.status === PAYMENT_STATUS.PAID) {
      this.noteEvent(payment, eventId);
      await payment.save();
      logger.info(`Payment ${payment.orderId} already PAID (${source}), ignoring`);
      return { ...payment.toPublic(), alreadyPaid: true };
    }

    payment.status = PAYMENT_STATUS.PAID;
    payment.paymentId = providerPaymentId || payment.paymentId || `pay_local_${Date.now()}`;
    this.noteEvent(payment, eventId);
    await payment.save();

    await safePublish(
      KAFKA_TOPICS.PAYMENT_SUCCESS,
      {
        paymentId: payment._id.toString(),
        auctionId: payment.auctionId,
        winnerId: payment.winnerId,
        sellerId: payment.sellerId,
        amountMinor: payment.amountMinor,
        orderId: payment.orderId,
        providerPaymentId: payment.paymentId,
        source
      },
      payment.auctionId
    );
    await safePublish(
      KAFKA_TOPICS.NOTIFICATION_EMAIL,
      {
        type: "PAYMENT_SUCCESS",
        userId: payment.sellerId,
        auctionId: payment.auctionId,
        amountMinor: payment.amountMinor
      },
      payment.sellerId
    );
    await safePublish(
      KAFKA_TOPICS.NOTIFICATION_EMAIL,
      {
        type: "PAYMENT_RECEIPT",
        userId: payment.winnerId,
        auctionId: payment.auctionId,
        amountMinor: payment.amountMinor
      },
      payment.winnerId
    );

    return { ...payment.toPublic(), alreadyPaid: false };
  }

  async listMine(userId, { page, limit }) {
    const { Payment } = models();
    const safePage = Math.max(1, parseInt(page || "1", 10));
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit || "20", 10)));

    const [items, total] = await Promise.all([
      Payment.find({ $or: [{ winnerId: userId }, { sellerId: userId }] })
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit),
      Payment.countDocuments({ $or: [{ winnerId: userId }, { sellerId: userId }] })
    ]);

    return {
      items: items.map((p) => p.toPublic()),
      pagination: { page: safePage, limit: safeLimit, total }
    };
  }

  async getByAuction(user, auctionId) {
    const { Payment } = models();
    const payment = await Payment.findOne({ auctionId }).sort({ createdAt: -1 });
    if (!payment) {
      throw ApiError.notFound("No payment for this auction");
    }
    if (payment.winnerId !== user.id && payment.sellerId !== user.id) {
      throw ApiError.forbidden("Not a participant of this auction");
    }
    return payment.toPublic();
  }

  get gatewayMode() {
    return gateway.mode;
  }
}

module.exports = new PaymentService();
