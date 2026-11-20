import bcrypt from "bcrypt";
import dotenv from "dotenv";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import User from "../models/userModel.js";
import EmailOTP from "../models/emailOTPModel.js";
import TrustedDevice from "../models/trustedDeviceModel.js";

import transporter from "../config/email.js";
import { validatePassword } from "../utils/validatePassword.js";
import {
    generateOTP,
    hashOTP,
    generateDeviceToken,
    hashDeviceToken,
} from "../utils/generateOTP.js";

dotenv.config();

// Read the password pepper from environment variables.
const pepper = process.env.PEPPER;

// Trusted device cookie name.
const DEVICE_COOKIE = "mmtp_trusted_device";

// OTP expiration time: 10 minutes.
const OTP_EXPIRY = 10 * 60 * 1000;

// Resend cooldown: 60 seconds.
const OTP_RESEND_COOLDOWN = 60 * 1000;

// Maximum OTP attempts.
const MAX_OTP_ATTEMPTS = 5;

// Helper: Generate a JWT after successful authentication.
function createToken(user) {
    return jwt.sign(
        {
            id: user._id.toString(),
            email: user.email,
            role: user.role,
            authVersion: user.authVersion,
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "48h",
        }
    );
}

// Helper: Return safe user information.
// Never return the password.
function getSafeUser(user) {
    return {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        image: user.image,
        isEmailVerified: user.isEmailVerified,
    };
}

// Helper: Send an OTP email and save its hashed OTP.
async function sendOTPEmail(user, purpose) {
    // Generate a secure six-digit OTP.
    const otp = generateOTP();

    // Hash the OTP before storing it.
    const otpHash = hashOTP(otp);

    // Remove any previous OTP for this user and purpose.
    await EmailOTP.deleteOne({
        user: user._id,
        purpose,
    });

    // Create a new OTP record.
    const otpRecord = await EmailOTP.create({
        user: user._id,
        email: user.email,
        purpose,
        otpHash,
        expiresAt: new Date(Date.now() + OTP_EXPIRY),
        attempts: 0,
        maxAttempts: MAX_OTP_ATTEMPTS,
        lastSentAt: new Date(),
    });

    try {
        // Send the OTP through Gmail.
        await transporter.sendMail({
            from: process.env.GMAIL_USER,
            to: user.email,

            subject:
                purpose === "email-verification"
                    ? "Verify your MMTP account"
                    : "Your MMTP login verification code",

            text:
                `Your MMTP verification code is ${otp}. ` +
                `It expires in 10 minutes. ` +
                `Do not share this code with anyone.`,

            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>MMTP Verification</h2>

                    <p>Your verification code is:</p>

                    <h1 style="letter-spacing: 8px;">
                        ${otp}
                    </h1>

                    <p>This code expires in 10 minutes.</p>

                    <p>
                        Never share this code with anyone.
                    </p>
                </div>
            `,
        });

        return true;

    } catch (error) {
        // Remove the OTP if sending the email fails.
        await EmailOTP.deleteOne({
            _id: otpRecord._id,
        });

        console.error("OTP email error:", error.message);

        throw new Error("OTP email could not be sent");
    }
}

// Helper: Issue a login token after successful OTP.
async function completeLogin(user, res) {
    // Update the user's last successful login time.
    user.lastLogin = new Date();

    await user.save();

    // Create the JWT only after verification.
    const token = createToken(user);

    return res.status(200).json({
        message: "Login successful",
        token,
        user: getSafeUser(user),
    });
}

// Admins cannot use trusted devices.
async function createTrustedDevice(user, req, res) {
    // Admin accounts must verify every login.
    if (user.role === "admin") {
        return;
    }

    // Renter trusted devices expire after 30 days.
    // Lender trusted devices expire after 3 days.
    const trustedDays =
        user.role === "lender" ? 3 : 30;

    const token = generateDeviceToken();

    // Store only the hashed device token.
    const tokenHash = hashDeviceToken(token);

    const expiresAt = new Date(
        Date.now() + trustedDays * 24 * 60 * 60 * 1000
    );

    // Save the trusted device in MongoDB.
    await TrustedDevice.create({
        user: user._id,
        tokenHash,
        deviceName: req.headers["user-agent"] || "Unknown device",
        userAgent: req.headers["user-agent"] || "",
        expiresAt,
        lastUsedAt: new Date(),
    });

    // Send the actual token through a secure cookie.
    res.cookie(DEVICE_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite:
            process.env.NODE_ENV === "production"
                ? "none"
                : "lax",
        expires: expiresAt,
        path: "/",
    });
}

// Creates a new renter account and sends email OTP.
export async function registerUser(req, res) {
    try {
        let {
            email,
            firstName,
            lastName,
            password,
            confirmPassword,
            phone,
        } = req.body;

        // Normalize user inputs.
        email = email?.trim().toLowerCase();
        firstName = firstName?.trim();
        lastName = lastName?.trim();
        phone = phone?.trim();

        // Check required fields.
        if (
            !email ||
            !firstName ||
            !lastName ||
            !password ||
            !confirmPassword ||
            !phone
        ) {
            return res.status(400).json({
                message: "All fields are required",
            });
        }

        // Only Gmail addresses are allowed for this project.
        const emailRegex =
            /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: "Please enter a valid Gmail address.",
            });
        }

        // Validate password data type.
        if (typeof password !== "string") {
            return res.status(400).json({
                message: "Invalid password",
            });
        }

        // Check password confirmation.
        if (password !== confirmPassword) {
            return res.status(400).json({
                message: "Passwords do not match",
            });
        }

        // Check password strength.
        const passwordErrors = validatePassword(password);

        if (passwordErrors.length > 0) {
            return res.status(400).json({
                message: `Password must contain ${passwordErrors.join(", ")}.`,
            });
        }

        // Validate phone number.
        if (!/^\d{10,15}$/.test(phone)) {
            return res.status(400).json({
                message: "Invalid phone number",
            });
        }

        // Check whether the email already exists.
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).json({
                message: "User already exists",
            });
        }

        // Hash the password using bcrypt and pepper.
        const hashedPassword = await bcrypt.hash(
            password + pepper,
            10
        );

        // Create a new account.
        // All new accounts start as renters.
        const user = await User.create({
            email,
            firstName,
            lastName,
            password: hashedPassword,
            phone,
            role: "renter",
            isEmailVerified: false,
        });

        // Send email verification OTP.
        await sendOTPEmail(
            user,
            "email-verification"
        );

        // Do not issue a JWT before email verification.
        return res.status(201).json({
            message: "Registration successful. Please verify your email.",
            requiresEmailVerification: true,
            email: user.email,
            userId: user._id,
        });

    } catch (error) {
        // Handle duplicate email database errors.
        if (error.code === 11000) {
            return res.status(409).json({
                message: "User already exists",
            });
        }

        console.error("Register error:", error.message);

        return res.status(500).json({
            message:
                "Registration failed. Please try again.",
        });
    }
}

// Checks password, email verification and trusted device.
export async function loginUser(req, res) {
    try {
        let { email, password } = req.body;

        // Normalize the email.
        email = email?.trim().toLowerCase();

        // Check required fields.
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required",
            });
        }

        // Validate Gmail address.
        const emailRegex =
            /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: "Please enter a valid Gmail address.",
            });
        }

        // Validate password length.
        if (
            typeof password !== "string" ||
            password.length < 8
        ) {
            return res.status(400).json({
                message: "Password must be at least 8 characters",
            });
        }

        // Find the user.
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        // Prevent blocked users from logging in.
        if (user.isBlocked) {
            return res.status(403).json({
                message:
                    "Your account is blocked. Please contact support.",
            });
        }

        // Compare the password with the stored hash.
        const isPasswordValid = await bcrypt.compare(
            password + pepper,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid email or password",
            });
        }

        // If the email is not verified, send verification OTP.
        if (!user.isEmailVerified) {
            await sendOTPEmail(
                user,
                "email-verification"
            );

            return res.status(200).json({
                message: "Please verify your email first.",
                requiresEmailVerification: true,
                email: user.email,
                userId: user._id,
            });
        }

        // Admins must verify OTP every time.
        // Lenders and renters can use trusted devices.
        if (user.role !== "admin") {
            const deviceToken =
                req.cookies?.[DEVICE_COOKIE];

            // If a trusted-device cookie exists,
            // check whether it is valid.
            if (deviceToken) {
                const tokenHash =
                    hashDeviceToken(deviceToken);

                const trustedDevice =
                    await TrustedDevice.findOne({
                        user: user._id,
                        tokenHash,
                        expiresAt: { $gt: new Date() },
                    });

                if (trustedDevice) {
                    // Update last-used time.
                    trustedDevice.lastUsedAt = new Date();

                    await trustedDevice.save();

                    // Login without OTP on trusted device.
                    return completeLogin(user, res);
                }
            }
        }

        // This device is not trusted.
        // Send login verification OTP.
        await sendOTPEmail(user, "login");

        return res.status(200).json({
            message: "OTP verification required.",
            requiresOTP: true,
            email: user.email,
            userId: user._id,
            role: user.role,
        });

    } catch (error) {
        console.error("Login error:", error.message);

        return res.status(500).json({
            message: "Login failed. Please try again.",
        });
    }
}

// Verifies new users after registration.
export async function verifyEmailOTP(req, res) {
    try {
        let { email, otp } = req.body;

        // Normalize the email.
        email = email?.trim().toLowerCase();

        // Check required fields.
        if (!email || !otp) {
            return res.status(400).json({
                message: "Email and OTP are required",
            });
        }

        // Find the user.
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        // Stop blocked accounts.
        if (user.isBlocked) {
            return res.status(403).json({
                message: "Your account is blocked",
            });
        }

        // Already verified.
        if (user.isEmailVerified) {
            return res.status(400).json({
                message: "Email is already verified",
            });
        }

        // Find the email verification OTP.
        const otpRecord = await EmailOTP.findOne({
            user: user._id,
            purpose: "email-verification",
        });

        if (!otpRecord) {
            return res.status(400).json({
                message: "OTP not found. Please request a new OTP.",
            });
        }

        // Check OTP expiry.
        if (otpRecord.expiresAt <= new Date()) {
            await EmailOTP.deleteOne({
                _id: otpRecord._id,
            });

            return res.status(400).json({
                message: "OTP expired. Please request a new OTP.",
            });
        }

        // Check maximum attempts.
        if (otpRecord.attempts >= otpRecord.maxAttempts) {
            await EmailOTP.deleteOne({
                _id: otpRecord._id,
            });

            return res.status(429).json({
                message: "Too many attempts. Request a new OTP.",
            });
        }

        // Compare the hashed OTP.
        const submittedHash = hashOTP(String(otp));

        if (
            !crypto.timingSafeEqual(
                Buffer.from(submittedHash),
                Buffer.from(otpRecord.otpHash)
            )
        ) {
            // Increase failed attempt count.
            otpRecord.attempts += 1;

            await otpRecord.save();

            return res.status(400).json({
                message: "Invalid OTP",
                remainingAttempts:
                    otpRecord.maxAttempts - otpRecord.attempts,
            });
        }

        // Mark the email as verified.
        user.isEmailVerified = true;

        await user.save();

        // Delete the OTP after successful verification.
        await EmailOTP.deleteOne({
            _id: otpRecord._id,
        });

        // Registration verification is successful.
        // The user may now continue to the application.
        return completeLogin(user, res);

    } catch (error) {
        console.error("Email verification error:", error.message);

        return res.status(500).json({
            message: "Email verification failed",
        });
    }
}

// Verify Login OTP
// Completes MFA login for renter, lender and admin.
export async function verifyLoginOTP(req, res) {
    try {
        let { email, otp, trustDevice } = req.body;

        // Normalize email.
        email = email?.trim().toLowerCase();

        // Check required fields.
        if (!email || !otp) {
            return res.status(400).json({
                message: "Email and OTP are required",
            });
        }

        // Find user.
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                message: "Invalid verification request",
            });
        }

        // Check blocked status.
        if (user.isBlocked) {
            return res.status(403).json({
                message: "Your account is blocked",
            });
        }

        // Email must already be verified.
        if (!user.isEmailVerified) {
            return res.status(403).json({
                message: "Please verify your email first",
            });
        }

        // Find the login OTP.
        const otpRecord = await EmailOTP.findOne({
            user: user._id,
            purpose: "login",
        });

        if (!otpRecord) {
            return res.status(400).json({
                message: "OTP not found. Please login again.",
            });
        }

        // Check OTP expiry.
        if (otpRecord.expiresAt <= new Date()) {
            await EmailOTP.deleteOne({
                _id: otpRecord._id,
            });

            return res.status(400).json({
                message: "OTP expired. Please login again.",
            });
        }

        // Check attempt limit.
        if (otpRecord.attempts >= otpRecord.maxAttempts) {
            await EmailOTP.deleteOne({
                _id: otpRecord._id,
            });

            return res.status(429).json({
                message: "Too many attempts. Please login again.",
            });
        }

        // Compare the submitted OTP hash.
        const submittedHash = hashOTP(String(otp));

        if (
            !crypto.timingSafeEqual(
                Buffer.from(submittedHash),
                Buffer.from(otpRecord.otpHash)
            )
        ) {
            otpRecord.attempts += 1;

            await otpRecord.save();

            return res.status(400).json({
                message: "Invalid OTP",
                remainingAttempts:
                    otpRecord.maxAttempts - otpRecord.attempts,
            });
        }

        // Delete OTP after successful verification.
        await EmailOTP.deleteOne({
            _id: otpRecord._id,
        });

        // Admins are never allowed to trust devices.
        // Renter/lender may trust this device.
        if (
            trustDevice === true &&
            user.role !== "admin"
        ) {
            await createTrustedDevice(
                user,
                req,
                res
            );
        }

        // Finish login and issue JWT.
        return completeLogin(user, res);

    } catch (error) {
        console.error("Login OTP error:", error.message);

        return res.status(500).json({
            message: "OTP verification failed",
        });
    }
}

// Resend OTP
// Supports email verification and login OTP.
export async function resendOTP(req, res) {
    try {
        let { email } = req.body;

        // Handle both a normal email string and an accidentally nested object.
        if (typeof email === "object" && email !== null) {
            email = email.email;
        }

        // Make sure email is a string before using trim().
        if (typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                message: "A valid email address is required",
            });
        }

        // Normalize email.
        email = email.trim().toLowerCase();

        // Find the user.
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                message: "User not found",
            });
        }

        // Block blocked accounts.
        if (user.isBlocked) {
            return res.status(403).json({
                message: "Your account is blocked",
            });
        }

        // Determine the OTP purpose.
        const purpose = user.isEmailVerified
            ? "login"
            : "email-verification";

        // Find the existing OTP.
        const existingOTP = await EmailOTP.findOne({
            user: user._id,
            purpose,
        });

        // Apply the resend cooldown.
        if (existingOTP && existingOTP.lastSentAt) {
            const timeSinceLastSent =
                Date.now() - existingOTP.lastSentAt.getTime();

            if (timeSinceLastSent < OTP_RESEND_COOLDOWN) {
                const remainingSeconds = Math.ceil(
                    (OTP_RESEND_COOLDOWN - timeSinceLastSent) / 1000
                );

                return res.status(429).json({
                    message: `Please wait ${remainingSeconds} seconds before requesting another OTP.`,
                    remainingSeconds,
                });
            }
        }

        // Send a new OTP.
        await sendOTPEmail(user, purpose);

        return res.status(200).json({
            message: "OTP sent successfully",
        });

    } catch (error) {
        // Print the complete error for debugging.
        console.error("Resend OTP error:", error);

        return res.status(500).json({
            message: "Unable to resend OTP",
        });
    }
}