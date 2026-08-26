const Product = require("../models/product.model");

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class ProductRepository {
  create(data) {
    return Product.create(data);
  }

  findById(id) {
    return Product.findOne({ _id: id, isRemoved: false });
  }

  async listBySeller({ sellerId, page, limit, q }) {
    const filter = { sellerId, isRemoved: false };
    if (q) {
      const expression = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: expression }, { category: expression }];
    }
    const [items, total] = await Promise.all([
      Product.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      Product.countDocuments(filter)
    ]);
    return { items, total };
  }

  async remove(id, sellerId) {
    return Product.updateOne({ _id: id, sellerId, isRemoved: false }, { $set: { isRemoved: true } });
  }
}

module.exports = new ProductRepository();
