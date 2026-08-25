const logger = require("@bidx/shared/utils/logger");
const { getConnection } = require("../config/db");
const { model: NotificationModel } = require("../models/notification.model");
const emailAdapter = require("../adapters/email.adapter");
const templateService = require("./template.service");

class NotificationService {
  constructor() {
    this.db = null;
  }

  init() {
    this.db = NotificationModel(getConnection());
  }

  async processEmail(event) {
    if (!event || !event.type || !event.userId) {
      logger.warn("Invalid notification event, skipping");
      return { status: "SKIPPED", reason: "invalid_event" };
    }

    const existing = await this.db.findOne({ eventId: event.eventId });
    if (existing) {
      logger.info(`Duplicate notification ${event.eventId}, skipping`);
      return { status: "SKIPPED", reason: "duplicate" };
    }

    const subject = templateService.getSubject(event.type, event);
    const html = templateService.render(event.type.toLowerCase(), {
      userId: event.userId,
      auctionId: event.auctionId,
      finalPrice: event.finalPrice,
      amountMinor: event.amountMinor,
      amount: event.amountMinor ? (event.amountMinor / 100).toFixed(2) : undefined,
      type: event.type
    });

    const result = await emailAdapter.send({
      to: `user-${event.userId.slice(-4)}@bidx.dev`,
      subject,
      html: html || `<p>${subject}</p>`
    });

    const record = await this.db.create({
      eventId: event.eventId,
      type: event.type,
      userId: event.userId,
      auctionId: event.auctionId,
      subject,
      status: result.success ? "SENT" : "FAILED",
      provider: result.provider,
      error: result.error,
      data: event
    });

    logger.info(
      `Notification ${event.type} → user ${event.userId.slice(-4)} [${record.status}]`
    );

    return { status: record.status, id: record._id };
  }

  async listByUser(userId, { limit = 20, offset = 0 } = {}) {
    return this.db
      .find({ userId })
      .sort({ sentAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();
  }

  async listByAuction(auctionId) {
    return this.db.find({ auctionId }).sort({ sentAt: -1 }).lean();
  }

  async stats() {
    const total = await this.db.countDocuments();
    const sent = await this.db.countDocuments({ status: "SENT" });
    const failed = await this.db.countDocuments({ status: "FAILED" });
    return { total, sent, failed };
  }
}

module.exports = new NotificationService();
