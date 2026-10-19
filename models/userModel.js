// import the mongoose
import mongoose from "mongoose";

// Creating a User Schema
const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true
    },

    firstName : {
        type : String,
        required : true,
    },

    lastName : {
        type : String,
        required : true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    phone: {
      type: String,
      required: true,
    },

    image : {
        type : String,
        default : "/images/default-profile.png",
        required : true,
    },

    role: {
      type: String,
      required : true,
      enum: ["renter", "lender", "admin"],
      default: "renter",
    },

    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      country: { type: String, default: "" },
      postalCode: { type: String, default: "" },
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    verificationDocuments: {
      type: [String], // image URLs or document links
      default: [],
    },

    rating: {
      type: Number,
      default: 0,
    },

    totalReviews: {
      type: Number,
      default: 0,
    },

    walletBalance: {
      type: Number,
      default: 0,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
)

// Creating a model from the schema
const User = mongoose.model("User", userSchema)

// Exporting the model so we can use it in other files
export default User;