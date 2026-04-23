import mongoose from "mongoose";

// Rental Product Schema
const productSchema = new mongoose.Schema(
  {
    // Public readable product ID
    productId: {
    type: String,
    required: true,
    unique: true,
    },

    // Title of the product
    title: {
      type: String,
      required: true
    },

    // Description
    description: {
      type: String,
      required: true,
    },

    // Alternative names (for search)
    altNames: {
      type: [String],
      default: [],
    },

    // Category
    category: {
      type: String,
      default: "Others",
      required: true
    },

    // Current rental price per day
    pricePerDay: {
      type: Number,
      required: true,
    },

    // Optional hourly price
    pricePerHour: {
      type: Number,
      default: null,
    },

    // Old price (for discount display)
    oldPrice: {
      type: Number,
      default: null,
    },

    // Security deposit
    deposit: {
      type: Number,
      default: 0,
    },

    // Availability period
    availability: {
      startDate: {
        type: Date,
      },
      endDate: {
        type: Date,
      },
    },

    // Owner reference (Lender)
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Location
    location: {
      city: { type: String, required: true },
      district: { type: String, default: "" },
      country: { type: String, default: "Sri Lanka" },
    },

    // Images
    images: {
      type: [String],
      default: ["/images/default-product.png"],
    },

    // Is product available
    isAvailable: {
      type: Boolean,
      default: true,
    },

    // Condition of item
    condition: {
      type: String,
      enum: ["new", "like new", "good", "used"],
      default: "good",
    },
  },
  {
    timestamps: true,
  }
);

// Create model
const Product = mongoose.model("Product", productSchema);

export default Product;