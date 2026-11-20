import mongoose from "mongoose";

// Product moderation history schema
const moderationHistorySchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
        },

        actor: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        note: {
            type: String,
            default: "",
        },

        fromStatus: {
            type: String,
            default: null,
        },

        toStatus: {
            type: String,
            default: null,
        },

        at: {
            type: Date,
            default: Date.now,
        },
    },
    {
        _id: false,
    }
);

// Rental Product Schema
const productSchema = new mongoose.Schema(
    {
        // Public readable product ID
        productId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        // Product title
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },

        // Product description
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 5000,
        },

        // Alternative names for searching
        altNames: {
            type: [String],
            default: [],
        },

        // Product category
        category: {
            type: String,
            default: "Others",
            required: true,
            trim: true,
        },

        // Rental price per day
        pricePerDay: {
            type: Number,
            required: true,
            min: 0,
        },

        // Optional rental price per hour
        pricePerHour: {
            type: Number,
            default: null,
            min: 0,
        },

        // Previous price
        oldPrice: {
            type: Number,
            default: null,
            min: 0,
        },

        // Security deposit
        deposit: {
            type: Number,
            default: 0,
            min: 0,
        },

        // Availability period
        availability: {
            startDate: {
                type: Date,
                default: null,
            },

            endDate: {
                type: Date,
                default: null,
            },
        },

        // Product owner
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // Admin who reviewed the initial listing
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        // Initial review date
        reviewedAt: {
            type: Date,
            default: null,
        },

        // Location
        location: {
            city: {
                type: String,
                required: true,
                trim: true,
            },

            district: {
                type: String,
                default: "",
                trim: true,
            },

            country: {
                type: String,
                default: "Sri Lanka",
                trim: true,
            },
        },

        // Product images
        images: {
            type: [String],
            default: ["/images/default-product.png"],
        },

        // Availability toggle
        isAvailable: {
            type: Boolean,
            default: true,
        },

        // Proposed product changes waiting for admin approval
        pendingChanges: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        // Status of proposed changes
        pendingUpdateStatus: {
            type: String,
            enum: ["pending", "approved", "rejected", null],
            default: null,
        },

        // Proposed update rejection reason
        pendingUpdateRejectionReason: {
            type: String,
            default: "",
        },

        // Admin who reviewed proposed changes
        pendingUpdateReviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        // Proposed changes review date
        pendingUpdateReviewedAt: {
            type: Date,
            default: null,
        },

        // Product approval status
        approvalStatus: {
            type: String,
            enum: [
                "pending",
                "approved",
                "rejected",
                "suspended",
            ],
            default: "pending",
            index: true,
        },

        // Product condition
        condition: {
            type: String,
            enum: ["new", "like new", "good", "used"],
            default: "good",
        },

        // Initial product rejection reason
        rejectionReason: {
            type: String,
            default: "",
        },

        // Soft deletion
        isDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },

        deletedAt: {
            type: Date,
            default: null,
        },

        deletedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        deletionReason: {
            type: String,
            default: "",
        },

        // Product moderation history
        moderationHistory: {
            type: [moderationHistorySchema],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

// Useful indexes
productSchema.index({
    approvalStatus: 1,
    isAvailable: 1,
    isDeleted: 1,
});

productSchema.index({
    owner: 1,
    createdAt: -1,
});

productSchema.index({
    category: 1,
    "location.city": 1,
});

// Create model
const Product = mongoose.model("Product", productSchema);

export default Product;