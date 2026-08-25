const Product = require("../models/product.model");

class ProductRepository {
  create(data) {
    return Product.create(data);
  }

  findById(id) {
    return Product.findOne({ _id: id, isRemoved: false });
  }

  async remove(id, sellerId) {
    return Product.updateOne({ _id: id, sellerId }, { $set: { isRemoved: true } });
  }
}

module.exports = new ProductRepository();
