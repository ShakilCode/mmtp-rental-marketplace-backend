import express from "express";

import {
    registerUser,
    loginUser,
    verifyEmailOTP,
    verifyLoginOTP,
    resendOTP,
} from "../controllers/userController.js";

// Create the user router.
const userRouter = express.Router();

// Register a new account.
userRouter.post("/register", registerUser);

// Login using email and password.
userRouter.post("/login", loginUser);

// Verify email after registration.
userRouter.post("/verify-email", verifyEmailOTP);

// Verify OTP during login.
userRouter.post("/verify-login-otp", verifyLoginOTP);

// Resend email verification or login OTP.
userRouter.post("/resend-otp", resendOTP);

export default userRouter;