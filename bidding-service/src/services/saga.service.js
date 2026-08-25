const { KAFKA_TOPICS } = require("@bidx/shared");
const publisher = require("@bidx/shared/kafka/producer");
const logger = require("@bidx/shared/utils/logger");
const env = require("../config/env");
const { sagaRepository, SAGA_STATE } = require("../models/saga.model");
const { bidRepository, BID_STATUS } = require("../models/bid.model");

async function safePublish(topic, data, key) {
  try {
    await publisher.publish(topic, data, { key });
  } catch (err) {
    logger.error(`Saga event publish failed for ${topic}: ${err.message}`);
  }
}

function deadlineFrom(now) {
  return new Date(now.getTime() + env.saga.deadlineMs);
}

const SAGA_ARM_RETRIES = 5;
const SAGA_ARM_RETRY_DELAY_MS = 600;

async function findAwaitingSaga(auctionId) {
  for (let attempt = 0; attempt < SAGA_ARM_RETRIES; attempt += 1) {
    const saga = await sagaRepository.findByAuction(auctionId);
    if (saga && saga.state === SAGA_STATE.AWAITING_PAYMENT) {
      return saga;
    }
    if (attempt < SAGA_ARM_RETRIES - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, SAGA_ARM_RETRY_DELAY_MS)
      );
    }
  }
  return null;
}

class SagaService {
  async onWinnerSelected(data) {
    const existing = await sagaRepository.findByAuction(data.auctionId);
    if (existing) {
      if (existing.currentWinnerId === data.winningBidderId) {
        return;
      }
      const advanced = await sagaRepository.advanceFallback({
        auctionId: data.auctionId,
        nextWinnerId: data.winningBidderId,
        nextPrice: Number(data.finalPrice),
        deadlineAt: deadlineFrom(new Date())
      });
      if (advanced) {
        await sagaRepository.markSuperseded(
          data.auctionId,
          existing.currentWinnerId
        );
      }
      return;
    }

    await sagaRepository.upsertInitial({
      auctionId: data.auctionId,
      sellerId: String(data.sellerId),
      winnerId: data.winningBidderId,
      finalPrice: Number(data.finalPrice),
      deadlineAt: deadlineFrom(new Date())
    });
    logger.info(
      `Saga armed for ${data.auctionId}: winner ${data.winningBidderId} owes ${data.finalPrice}, deadline in ${env.saga.deadlineMs}ms`
    );
  }

  async onPaymentSuccess(data) {
    const current = await findAwaitingSaga(data.auctionId);
    if (!current) {
      return;
    }
    if (current.currentWinnerId !== String(data.winnerId)) {
      logger.warn(
        `Stale payment.success for ${data.auctionId} by ${data.winnerId}; current winner is ${current.currentWinnerId}`
      );
      return;
    }

    const saga = await sagaRepository.markPaid(data.auctionId, data.winnerId);
    if (!saga) {
      return;
    }
    logger.info(`Saga COMPLETED for ${data.auctionId} (paid by ${data.winnerId})`);

    await safePublish(
      KAFKA_TOPICS.AUCTION_SOLD,
      {
        auctionId: data.auctionId,
        winningBidderId: data.winnerId,
        finalPrice: Number(data.amountMinor) / 100,
        sellerId: saga.sellerId
      },
      data.auctionId
    );
    await safePublish(
      KAFKA_TOPICS.NOTIFICATION_EMAIL,
      {
        type: "AUCTION_SOLD",
        userId: saga.sellerId,
        auctionId: data.auctionId,
        finalPrice: Number(data.amountMinor) / 100
      },
      saga.sellerId
    );
  }

  async onPaymentFailed(data) {
    const saga = await findAwaitingSaga(data.auctionId);
    if (!saga) {
      return;
    }
    if (saga.currentWinnerId !== String(data.winnerId)) {
      logger.warn(
        `Stale payment.failed for ${data.auctionId} by ${data.winnerId}; current winner is ${saga.currentWinnerId}`
      );
      return;
    }
    logger.info(`Payment failed for ${data.auctionId}; triggering immediate fallback`);
    await this.fallbackToNextBidder(saga, "payment_failed");
  }

  async fallbackToNextBidder(saga, reason) {
    const triedIds = (saga.winnerHistory || []).map((entry) => entry.userId);

    const { items } = await bidRepository.listByAuction(saga.auctionId, {
      page: 1,
      limit: 200
    });

    const bestPerBidder = new Map();
    for (const bid of items) {
      if (bid.status !== BID_STATUS.ACCEPTED) continue;
      const key = String(bid.bidderId);
      if (triedIds.includes(key)) continue;
      if (!bestPerBidder.has(key) || bid.amount > bestPerBidder.get(key)) {
        bestPerBidder.set(key, bid.amount);
      }
    }

    if (bestPerBidder.size === 0) {
      await this.exhaustAuction(saga, reason);
      return null;
    }

    const ranked = [...bestPerBidder.entries()].sort((a, b) => b[1] - a[1]);
    const [nextWinnerId, nextPrice] = ranked[0];

    const previousWinnerId = saga.currentWinnerId;

    const updated = await sagaRepository.advanceFallback({
      auctionId: saga.auctionId,
      nextWinnerId,
      nextPrice,
      deadlineAt: deadlineFrom(new Date())
    });
    if (!updated) {
      return null;
    }

    await sagaRepository.markSuperseded(saga.auctionId, previousWinnerId);

    logger.info(
      `Saga fallback ${saga.auctionId}: ${previousWinnerId} -> ${nextWinnerId} at ${nextPrice} (${reason})`
    );

    await safePublish(
      KAFKA_TOPICS.WINNER_SELECTED,
      {
        auctionId: saga.auctionId,
        winningBidderId: nextWinnerId,
        sellerId: saga.sellerId,
        finalPrice: nextPrice,
        paymentDeadlineHours: Math.round(env.saga.deadlineMs / 3600000)
      },
      saga.auctionId
    );

    await safePublish(
      KAFKA_TOPICS.NOTIFICATION_EMAIL,
      {
        type: "WINNER_FALLBACK",
        userId: nextWinnerId,
        auctionId: saga.auctionId,
        amount: nextPrice
      },
      nextWinnerId
    );
    if (previousWinnerId) {
      await safePublish(
        KAFKA_TOPICS.NOTIFICATION_EMAIL,
        {
          type: "SALE_LOST",
          userId: previousWinnerId,
          auctionId: saga.auctionId
        },
        previousWinnerId
      );
    }

    return { nextWinnerId, nextPrice };
  }

  async exhaustAuction(saga, reason) {
    const exhausted = await sagaRepository.markExhausted(saga.auctionId);
    if (!exhausted) {
      return;
    }
    logger.info(`Saga EXHAUSTED for ${saga.auctionId} (${reason}) - no eligible bidders remain`);

    await safePublish(
      KAFKA_TOPICS.AUCTION_UNSOLD,
      {
        auctionId: saga.auctionId,
        sellerId: saga.sellerId,
        reason: "ALL_WINNERS_DECLINED"
      },
      saga.auctionId
    );
    await safePublish(
      KAFKA_TOPICS.NOTIFICATION_EMAIL,
      {
        type: "AUCTION_UNSOLD",
        userId: saga.sellerId,
        auctionId: saga.auctionId
      },
      saga.sellerId
    );
  }

  async scanExpired() {
    const now = new Date();
    const expired = await sagaRepository.findAwaitingPastDeadline(now);
    let processed = 0;
    for (const saga of expired) {
      try {
        await this.fallbackToNextBidder(saga, "deadline_expired");
        processed += 1;
      } catch (err) {
        logger.error(`Saga scan failed for ${saga.auctionId}: ${err.message}`);
      }
    }
    return processed;
  }
}

module.exports = { SagaService };
