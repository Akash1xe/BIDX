const Auction = require("../models/auction.model");
const { AUCTION_STATUS } = require("../models/auction.model");

class AuctionRepository {
  create(data) {
    return Auction.create(data);
  }

  findById(id) {
    return Auction.findById(id);
  }

  list({ status, sellerId, category, page = 1, limit = 20 }) {
    const query = {};
    if (status) {
      query.status = Array.isArray(status) ? { $in: status } : status;
    }
    if (sellerId) {
      query.sellerId = sellerId;
    }
    if (category) {
      query["product.category"] = category.toLowerCase();
    }
    return Auction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  count(query) {
    return Auction.countDocuments(query);
  }

  async updateById(id, updates) {
    return Auction.findByIdAndUpdate(id, { $set: updates }, { new: true });
  }

  deleteById(id) {
    return Auction.deleteOne({ _id: id });
  }
}

module.exports = new AuctionRepository();
