import mongoose from "mongoose";

// Stores trusted devices for renter and lender accounts.
const trustedDeviceSchema = new mongoose.Schema(
    {
        // User who owns the trusted device.
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // Hash of the trusted-device token.
        // The actual token is never stored in MongoDB.
        tokenHash: {
            type: String,
            required: true,
            unique: true,
        },

        // Friendly device name.
        deviceName: {
            type: String,
            default: "Unknown device",
        },

        // Browser information for displaying the device.
        userAgent: {
            type: String,
            default: "",
        },

        // Device expiration date.
        expiresAt: {
            type: Date,
            required: true,
        },

        // Last time this trusted device was used.
        lastUsedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// Automatically delete expired trusted devices.
trustedDeviceSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

// Create the trusted-device model.
const TrustedDevice = mongoose.model(
    "TrustedDevice",
    trustedDeviceSchema
);

// Export the model.
export default TrustedDevice;