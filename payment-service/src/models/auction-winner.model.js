const mongoose = require("mongoose");

const auctionWinnerSchema = (connection) => {
  const schema = new mongoose.Schema(
    {
      auctionId: {
        type: String,
        required: true,
        unique: true
      },
      winnerId: {
        type: String,
        required: true,
        index: true
      },
      sellerId: {
        type: String,
        required: true
      },
      finalPrice: {
        type: Number,
        required: true,
        min: 0
      },
      outcome: {
        type: String,
        required: true
      },
      endedAt: {
        type: Date,
        default: null
      }
    },
    { timestamps: true }
  );

  return connection.models.AuctionWinner || connection.model("AuctionWinner", schema);
};

module.exports = { auctionWinnerSchema };
