const mongoose = require("mongoose");
const db = require("../config/db");

const BID_STATUS = Object.freeze({
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED"
});

const bidSchema = new mongoose.Schema(
  {
    auctionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    bidderId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: Object.values(BID_STATUS),
      default: BID_STATUS.ACCEPTED
    }
  },
  {
    timestamps: true
  }
);

bidSchema.index({ auctionId: 1, createdAt: -1 });

function getModel() {
  return db.get("bids").model("Bid", bidSchema);
}

const bidRepository = {
  async create({ auctionId, bidderId, amount, status }) {
    const Bid = getModel();
    return Bid.create({ auctionId, bidderId, amount, status });
  },

  async listByAuction(auctionId, { page = 1, limit = 20 } = {}) {
    const Bid = getModel();
    const filter = { auctionId };
    const [items, total] = await Promise.all([
      Bid.find(filter)
        .sort({ amount: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Bid.countDocuments(filter)
    ]);
    return { items, total };
  },

  async countByAuction(auctionId) {
    const Bid = getModel();
    return Bid.countDocuments({ auctionId, status: BID_STATUS.ACCEPTED });
  },

  async listMine(bidderId, { page = 1, limit = 20 } = {}) {
    const Bid = getModel();
    const filter = { bidderId };
    const [items, total] = await Promise.all([
      Bid.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Bid.countDocuments(filter)
    ]);
    return { items, total };
  }
};

module.exports = { bidRepository, BID_STATUS };
