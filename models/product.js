import mongoose from "mongoose";

// Rental Product Schema
const productSchema = new mongoose.Schema(
  {
    // Public readable product ID
    productId: {
    type: String,
    required: true,
    unique: true,
    trim: true
    },

    // Title of the product
    title: {
      type: String,
      required: true,
      trim: true
    },

    // Description
    description: {
      type: String,
      required: true,
      trim: true
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
      required: true,
      trim: true
    },

    // Current rental price per day
    pricePerDay: {
      type: Number,
      required: true,
      min: 0
    },

    // Optional hourly price
    pricePerHour: {
      type: Number,
      default: null,
      min: 0
    },

    // Old price (for discount display)
    oldPrice: {
      type: Number,
      default: null,
      min: 0
    },

    // Security deposit
    deposit: {
      type: Number,
      default: 0,
      min: 0
    },

    // Availability period
    availability: {
      startDate: {
        type: Date,
        default: null
      },
      endDate: {
        type: Date,
        default: null
      },
    },

    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    reviewedAt: {
      type: Date,
      default: null
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

    // Proposed product changes waiting for admin approval
    pendingChanges: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },

    // Admin approval
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true
    },

    // Condition of item
    condition: {
      type: String,
      enum: ["new", "like new", "good", "used"],
      default: "good",
    },

    rejectionReason: {
      type: String,
      default: ""
    },
    
  },
  {
    timestamps: true,
  }
);

// Create model
const Product = mongoose.model("Product", productSchema);

export default Product;