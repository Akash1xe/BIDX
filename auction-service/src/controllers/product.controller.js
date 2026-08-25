const { ApiResponse, ApiError } = require("@bidx/shared");
const { asyncHandler } = require("../utils/async-handler.util");
const productService = require("../services/product.service");

function requireSeller(req) {
  if (!req.user) {
    throw ApiError.unauthorized("Authentication required");
  }
  if (req.user.role !== "SELLER" && req.user.role !== "ADMIN") {
    throw ApiError.forbidden("Requires SELLER role");
  }
}

const createProduct = asyncHandler(async (req, res) => {
  requireSeller(req);
  const { name, description, images, category, condition } = req.body;
  if (!name || typeof name !== "string" || name.trim() === "") {
    throw ApiError.badRequest("Field 'name' is required");
  }
  if (!category || typeof category !== "string" || category.trim() === "") {
    throw ApiError.badRequest("Field 'category' is required");
  }
  const product = await productService.create({
    sellerId: req.user.id,
    name: name.trim(),
    description: typeof description === "string" ? description.trim() : undefined,
    images: Array.isArray(images) ? images.filter((i) => typeof i === "string") : undefined,
    category: category.trim().toLowerCase(),
    condition
  });
  return ApiResponse.success(res, {
    statusCode: 201,
    message: "Product created",
    data: product
  });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await productService.getById(req.params.productId);
  return ApiResponse.success(res, { message: "Product fetched", data: product });
});

const deleteProduct = asyncHandler(async (req, res) => {
  const result = await productService.remove(req.params.productId, req.user.id);
  return ApiResponse.success(res, { message: "Product removed", data: result });
});

module.exports = { createProduct, getProduct, deleteProduct };
