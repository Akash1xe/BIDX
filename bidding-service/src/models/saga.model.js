const mongoose = require("mongoose");
const db = require("../config/db");

const SAGA_STATE = Object.freeze({
  AWAITING_PAYMENT: "AWAITING_PAYMENT",
  COMPLETED: "COMPLETED",
  EXHAUSTED: "EXHAUSTED"
});

const sagaSchema = new mongoose.Schema(
  {
    auctionId: {
      type: String,
      required: true,
      unique: true
    },
    sellerId: {
      type: String,
      required: true
    },
    state: {
      type: String,
      enum: Object.values(SAGA_STATE),
      default: SAGA_STATE.AWAITING_PAYMENT
    },
    currentWinnerId: {
      type: String,
      default: null
    },
    currentPrice: {
      type: Number,
      default: 0
    },
    winnerHistory: [
      {
        userId: String,
        finalPrice: Number,
        offeredAt: Date,
        outcome: { type: String, enum: ["PENDING", "PAID", "DECLINED", "SUPERSEDED"] }
      }
    ],
    deadlineAt: {
      type: Date,
      required: true
    }
  },
  { timestamps: true }
);

function getModel() {
  return db.get("bids").model("BidSaga", sagaSchema);
}

const sagaRepository = {
  async upsertInitial({ auctionId, sellerId, winnerId, finalPrice, deadlineAt }) {
    const Saga = getModel();
    const existing = await Saga.findOne({ auctionId });
    if (existing) {
      return existing;
    }
    return Saga.create({
      auctionId,
      sellerId,
      currentWinnerId: winnerId,
      currentPrice: finalPrice,
      deadlineAt,
      winnerHistory: [
        { userId: winnerId, finalPrice, offeredAt: new Date(), outcome: "PENDING" }
      ]
    });
  },

  async findByAuction(auctionId) {
    const Saga = getModel();
    return Saga.findOne({ auctionId });
  },

  async markPaid(auctionId, userId) {
    const Saga = getModel();
    const updated = await Saga.findOneAndUpdate(
      { auctionId, state: SAGA_STATE.AWAITING_PAYMENT },
      {
        $set: {
          state: SAGA_STATE.COMPLETED,
          "winnerHistory.$[entry].outcome": "PAID"
        }
      },
      {
        arrayFilters: [{ "entry.userId": userId }],
        new: true
      }
    );
    return updated;
  },

  async advanceFallback({ auctionId, nextWinnerId, nextPrice, deadlineAt }) {
    const Saga = getModel();
    return Saga.findOneAndUpdate(
      {
        auctionId,
        state: SAGA_STATE.AWAITING_PAYMENT,
        "winnerHistory.userId": { $ne: nextWinnerId }
      },
      {
        $set: {
          currentWinnerId: nextWinnerId,
          currentPrice: nextPrice,
          deadlineAt
        },
        $push: {
          winnerHistory: {
            userId: nextWinnerId,
            finalPrice: nextPrice,
            offeredAt: new Date(),
            outcome: "PENDING"
          }
        }
      },
      { new: true }
    );
  },

  async markSuperseded(auctionId, userId) {
    const Saga = getModel();
    await Saga.updateOne(
      { auctionId, "winnerHistory.userId": userId },
      { $set: { "winnerHistory.$.outcome": "SUPERSEDED" } }
    );
  },

  async markDeclined(auctionId, userId) {
    const Saga = getModel();
    await Saga.updateOne(
      { auctionId, state: SAGA_STATE.AWAITING_PAYMENT, "winnerHistory.userId": userId },
      { $set: { "winnerHistory.$.outcome": "DECLINED" } }
    );
  },

  async markExhausted(auctionId) {
    const Saga = getModel();
    return Saga.findOneAndUpdate(
      { auctionId, state: SAGA_STATE.AWAITING_PAYMENT },
      { $set: { state: SAGA_STATE.EXHAUSTED } },
      { new: true }
    );
  },

  async findAwaitingPastDeadline(now, limit = 50) {
    const Saga = getModel();
    return Saga.find({
      state: SAGA_STATE.AWAITING_PAYMENT,
      deadlineAt: { $lte: now }
    })
      .limit(limit)
      .lean();
  }
};

module.exports = { sagaRepository, SAGA_STATE };
