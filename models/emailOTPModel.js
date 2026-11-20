import mongoose from "mongoose";

// Stores OTP verification records for users.
const emailOTPSchema = new mongoose.Schema(
    {
        // The user who requested the OTP.
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        // Email address receiving the OTP.
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },

        // Purpose of the OTP.
        purpose: {
            type: String,
            required: true,
            enum: ["email-verification", "login"],
        },

        // Store a hashed OTP, not the original OTP.
        otpHash: {
            type: String,
            required: true,
        },

        // OTP expiry time.
        expiresAt: {
            type: Date,
            required: true,
        },

        // Number of incorrect OTP attempts.
        attempts: {
            type: Number,
            default: 0,
        },

        // Maximum number of OTP attempts.
        maxAttempts: {
            type: Number,
            default: 5,
        },

        // When the OTP was last sent.
        lastSentAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

// MongoDB automatically deletes expired OTP records.
emailOTPSchema.index(
    { expiresAt: 1 },
    { expireAfterSeconds: 0 }
);

// A user can have only one OTP for the same purpose.
emailOTPSchema.index(
    { user: 1, purpose: 1 },
    { unique: true }
);

// Create the OTP model.
const EmailOTP = mongoose.model("EmailOTP", emailOTPSchema);

// Export the model.
export default EmailOTP;