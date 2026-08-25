const { ApiError } = require("@bidx/shared");
const productRepository = require("../repositories/product.repository");

class ProductService {
  async create({ sellerId, name, description, images, category, condition }) {
    const product = await productRepository.create({
      name,
      description,
      images: images || [],
      category,
      condition,
      sellerId
    });
    return product.toPublic();
  }

  async getById(productId) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }
    return product.toPublic();
  }

  async remove(productId, sellerId) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }
    if (product.sellerId.toString() !== String(sellerId)) {
      throw ApiError.forbidden("You do not own this product");
    }
    const result = await productRepository.remove(productId, sellerId);
    if (result.matchedCount === 0) {
      throw ApiError.notFound("Product not found");
    }
    return { removed: true };
  }
}

module.exports = new ProductService();
