const env = require("../config/env");
const logger = require("@bidx/shared/utils/logger");

const INDEX = () => env.elasticsearch.auctionsIndex;

function assertCondition(condition, message) {
  if (!condition) {
    const err = new Error(`InvalidPayload: ${message}`);
    err.name = "InvalidPayloadError";
    throw err;
  }
}

function validateCommon(data) {
  assertCondition(data && typeof data === "object", "event data must be an object");
  assertCondition(typeof data.auctionId === "string" && data.auctionId.length >= 12, "auctionId is missing or malformed");
}

function baseDoc(data, now) {
  return {
    auctionId: data.auctionId,
    productId: data.productId || null,
    sellerId: data.sellerId || null,
    name: data.name || "",
    description: data.description || "",
    images: Array.isArray(data.images) ? data.images : [],
    category: (data.category || "").toLowerCase() || null,
    condition: data.condition || null,
    startingPrice: Number(data.startingPrice) || 0,
    minimumIncrement: Number(data.minimumIncrement) || 0,
    currentPrice: 0,
    bidCount: 0,
    status: data.status,
    startTime: data.startTime,
    endTime: data.endTime,
    indexedAt: now
  };
}

class IndexerService {
  constructor(es) {
    this.es = es;
  }

  async applyCreated(data) {
    validateCommon(data);
    assertCondition(typeof data.status === "string" && data.status.length > 0, "status is required on auction.created");
    assertCondition(Number.isFinite(Number(data.startingPrice)), "startingPrice must be numeric on auction.created");

    await this.es.index({
      index: INDEX(),
      id: data.auctionId,
      document: baseDoc(data, new Date().toISOString())
    });
    logger.debug(`Indexed auction ${data.auctionId} (${data.status})`);
  }

  async applyUpdated(data) {
    validateCommon(data);
    if (!data.updates) {
      // legacy event without payload values - nothing to merge
      return;
    }
    assertCondition(typeof data.updates === "object", "updates must be an object on auction.updated");

    const doc = {};
    if (data.updates.startingPrice !== undefined) doc.startingPrice = data.updates.startingPrice;
    if (data.updates.minimumIncrement !== undefined) doc.minimumIncrement = data.updates.minimumIncrement;
    if (data.updates.startTime !== undefined) doc.startTime = data.updates.startTime;
    if (data.updates.endTime !== undefined) doc.endTime = data.updates.endTime;
    if (Object.keys(doc).length === 0) return;

    await this.es.update({
      index: INDEX(),
      id: data.auctionId,
      doc,
      retry_on_conflict: 3
    });
    logger.debug(`Updated indexed auction ${data.auctionId}: ${Object.keys(doc).join(", ")}`);
  }

  async applyStarted(data) {
    validateCommon(data);
    await this.es.update({
      index: INDEX(),
      id: data.auctionId,
      doc: { status: "LIVE", startTime: data.startedAt || new Date().toISOString() },
      retry_on_conflict: 3
    });
    logger.debug(`Indexed auction ${data.auctionId} -> LIVE`);
  }

  async applyEnded(data) {
    validateCommon(data);
    assertCondition(typeof data.outcome === "string" && data.outcome.length > 0, "outcome is required on auction.ended");

    const status = data.outcome === "NO_VALID_BID" ? "UNSOLD" : "ENDED";
    const doc = {
      status,
      endedAt: data.endedAt || new Date().toISOString()
    };
    const finalPrice = Number(data.finalPrice ?? data.finalBid);
    if (Number.isFinite(finalPrice) && finalPrice > 0) {
      doc.currentPrice = finalPrice;
    }
    if (data.winningBidderId) {
      doc.winningBidderId = data.winningBidderId;
    }
    await this.es.update({
      index: INDEX(),
      id: data.auctionId,
      doc,
      retry_on_conflict: 3
    });
    logger.debug(`Indexed auction ${data.auctionId} -> ${status}`);
  }

  async applyWinnerSelected(data) {
    validateCommon(data);
    assertCondition(
      typeof data.winningBidderId === "string" && data.winningBidderId.length >= 12,
      "winningBidderId is required on winner.selected"
    );
    assertCondition(
      Number.isFinite(Number(data.finalPrice)) && Number(data.finalPrice) > 0,
      "finalPrice must be positive on winner.selected"
    );

    await this.es.update({
      index: INDEX(),
      id: data.auctionId,
      doc: {
        winningBidderId: data.winningBidderId,
        currentPrice: Number(data.finalPrice)
      },
      retry_on_conflict: 3
    });
    logger.debug(`Indexed winner ${data.winningBidderId} for ${data.auctionId}`);
  }

  async applyAuctionSold(data) {
    validateCommon(data);
    const doc = { status: "SOLD" };
    if (Number(data.finalPrice) > 0) {
      doc.currentPrice = Number(data.finalPrice);
    }
    if (data.winningBidderId) {
      doc.winningBidderId = data.winningBidderId;
    }
    await this.es.update({
      index: INDEX(),
      id: data.auctionId,
      doc,
      retry_on_conflict: 3
    });
    logger.debug(`Indexed auction ${data.auctionId} -> SOLD`);
  }

  async applyAuctionUnsold(data) {
    validateCommon(data);
    await this.es.update({
      index: INDEX(),
      id: data.auctionId,
      doc: { status: "UNSOLD", winningBidderId: null },
      retry_on_conflict: 3
    });
    logger.debug(`Indexed auction ${data.auctionId} -> UNSOLD`);
  }

  async applyDeleted(data) {
    const auctionId = typeof data === "string" ? data : data?.auctionId;
    assertCondition(typeof auctionId === "string" && auctionId.length >= 12, "auctionId is missing on auction.deleted");

    await this.es.delete({
      index: INDEX(),
      id: auctionId
    }).catch((err) => {
      if (err.meta?.statusCode !== 404 && err.statusCode !== 404) throw err;
    });
    logger.debug(`Removed indexed auction ${auctionId}`);
  }

  async refresh() {
    await this.es.indices.refresh({ index: INDEX() });
  }
}

module.exports = { IndexerService };
