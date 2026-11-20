import mongoose from "mongoose";

// This schema stores all information about MMTP users.
const userSchema = new mongoose.Schema(
    {
        // Every user must have a unique email address.
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },

        // User's first name.
        firstName: {
            type: String,
            required: true,
            trim: true,
        },

        // User's last name.
        lastName: {
            type: String,
            required: true,
            trim: true,
        },

        // Store only the hashed password.
        password: {
            type: String,
            required: true,
            minlength: 8,
        },

        // User's phone number.
        phone: {
            type: String,
            default: "",
            required: true,
            unique: true,
        },

        // Profile picture.
        image: {
            type: String,
            default: "/images/default-profile.png",
            required: true,
        },

        // Every new account starts as a renter.
        role: {
            type: String,
            required: true,
            enum: ["renter", "lender", "admin"],
            default: "renter",
        },

        // User's address information.
        address: {
            street: { type: String, default: "" },
            city: { type: String, default: "" },
            state: { type: String, default: "" },
            country: { type: String, default: "" },
            postalCode: { type: String, default: "" },
        },

        // True only after the email OTP is successfully verified.
        isEmailVerified: {
            type: Boolean,
            default: false,
        },

        // Phone verification can be implemented later.
        isPhoneVerified: {
            type: Boolean,
            default: false,
        },

        // Documents uploaded for lender verification.
        verificationDocuments: {
            type: [String],
            default: [],
        },

        // Average user rating.
        rating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },

        // Total number of reviews.
        totalReviews: {
            type: Number,
            default: 0,
        },

        // User's wallet balance.
        walletBalance: {
            type: Number,
            default: 0,
        },

        // Admin can block a user from using the platform.
        isBlocked: {
            type: Boolean,
            default: false,
        },

        // Reason why an admin blocked the account.
        reasonForBlocking: {
            type: String,
            default: "",
        },

        // Date and time of the last successful login.
        lastLogin: {
            type: Date,
            default: null,
        },

        // Used to invalidate old JWT sessions after security changes.
        authVersion: {
            type: Number,
            default: 0,
        },
    },
    {
        // Automatically creates createdAt and updatedAt.
        timestamps: true,
    }
);

// Create the User model.
const User = mongoose.model("User", userSchema);

// Export the model for other files.
export default User;