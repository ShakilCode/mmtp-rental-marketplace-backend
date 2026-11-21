import mongoose from "mongoose";

// Product moderation history
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
            maxlength: 2000,
        },

        rejectionReason: {
            type: String,
            default: "",
            maxlength: 2000,
        },

        // Preserve proposed or changed fields for audit purposes
        changes: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
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

// Product Schema
const productSchema = new mongoose.Schema(
    {
        // Unique public product reference
        productId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },

        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 5000,
        },

        altNames: {
            type: [String],
            default: [],
        },

        category: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
            default: "Others",
        },

        pricePerDay: {
            type: Number,
            required: true,
            min: 0,
        },

        pricePerHour: {
            type: Number,
            default: null,
            min: 0,
        },

        oldPrice: {
            type: Number,
            default: null,
            min: 0,
        },

        deposit: {
            type: Number,
            default: 0,
            min: 0,
        },

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

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // Admin review of initial product
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        reviewedAt: {
            type: Date,
            default: null,
        },

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

        images: {
            type: [String],
            default: ["/images/default-product.png"],
        },

        isAvailable: {
            type: Boolean,
            default: true,
        },

        // Lender's proposed update
        pendingChanges: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        pendingUpdateStatus: {
            type: String,
            enum: ["pending", "approved", "rejected", null],
            default: null,
        },

        pendingUpdateRejectionReason: {
            type: String,
            default: "",
            maxlength: 2000,
        },

        pendingUpdateReviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        pendingUpdateReviewedAt: {
            type: Date,
            default: null,
        },

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

        condition: {
            type: String,
            enum: ["new", "like new", "good", "used"],
            default: "good",
        },

        rejectionReason: {
            type: String,
            default: "",
            maxlength: 2000,
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
            maxlength: 2000,
        },

        // Auditable moderation history
        moderationHistory: {
            type: [moderationHistorySchema],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
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

productSchema.index({
    title: "text",
    description: "text",
    altNames: "text",
});

// Model
const Product = mongoose.model("Product", productSchema);

export default Product;