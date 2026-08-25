const logger = require("@bidx/shared/utils/logger");
const Auction = require("../models/auction.model");
const { finalizeExpiredAuction } = require("../services/completion.service");

class CompletionScheduler {
  constructor({ intervalMs } = {}) {
    this.intervalMs = intervalMs || parseInt(process.env.COMPLETION_INTERVAL_MS || "5000", 10);
    this.timer = null;
    this.running = false;
    this.ticking = false;
  }

  start() {
    if (this.timer) {
      return;
    }
    this.running = true;
    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        logger.error(`Completion scheduler tick failed: ${err.message}`);
      });
    }, this.intervalMs);
    this.timer.unref();
    logger.info(`Completion scheduler started (interval=${this.intervalMs}ms)`);
  }

  async tick() {
    if (this.ticking) {
      return;
    }
    this.ticking = true;
    try {
      const expired = await Auction.find({
        status: "LIVE",
        endTime: { $lte: new Date() }
      })
        .limit(50)
        .select("_id currentBid highestBidderId sellerId endedAt")
        .lean();

      for (const auction of expired) {
        try {
          await finalizeExpiredAuction(auction);
        } catch (err) {
          logger.error(`Failed to finalize auction ${auction._id.toString()}: ${err.message}`);
        }
      }
      return expired.length;
    } finally {
      this.ticking = false;
    }
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
    logger.info("Completion scheduler stopped");
  }
}

module.exports = { CompletionScheduler };
