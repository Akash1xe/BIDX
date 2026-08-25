const mongoose = require("mongoose");

const PRODUCT_CONDITIONS = Object.freeze({
  NEW: "NEW",
  LIKE_NEW: "LIKE_NEW",
  USED: "USED",
  REFURBISHED: "REFURBISHED"
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000
    },
    images: {
      type: [String],
      default: []
    },
    category: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    condition: {
      type: String,
      enum: Object.values(PRODUCT_CONDITIONS),
      default: PRODUCT_CONDITIONS.USED
    },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    isRemoved: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

productSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    description: this.description,
    images: this.images,
    category: this.category,
    condition: this.condition,
    sellerId: this.sellerId.toString(),
    createdAt: this.createdAt
  };
};

module.exports = mongoose.model("Product", productSchema);
