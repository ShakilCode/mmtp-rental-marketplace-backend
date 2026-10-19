import bcrypt from 'bcrypt'
import dotenv from "dotenv"
import User from '../models/userModel.js'
// JWT (JSON Web Token) is used for login authentication
import jwt from 'jsonwebtoken'
import { validatePassword } from '../utils/validatePassword.js'

dotenv.config()

const pepper = process.env.PEPPER

// Register User
export async function registerUser(req, res) {
    try {
        // Get data from request body
        let {
            email,
            firstName,
            lastName,
            password,
            confirmPassword,
            phone
        } = req.body;

        // Trim + normalize inputs
        email = email?.trim().toLowerCase();
        firstName = firstName?.trim();
        lastName = lastName?.trim();
        phone = phone?.trim();

        // 1. Check required fields
        if (
            !email ||
            !firstName ||
            !lastName ||
            !password ||
            !confirmPassword
        ) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        // 2. Email format validation
        const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: "Please enter a valid Gmail address ending in @gmail.com."
            });
        }

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: "Invalid email format"
            });
        }

        // 3. Password match check
        if (password !== confirmPassword) {
            return res.status(400).json({
                message: "Passwords do not match"
            });
        }

        // 4. Strong password validation
        const passwordErrors = validatePassword(password);

        if (passwordErrors.length > 0) {
            return res.status(400).json({
                message: `Password must contain ${passwordErrors.join(", ")}.`
            });
        }

        // 5. Phone validation
        if (!/^\d{10,15}$/.test(phone)) {
            return res.status(400).json({
                message: "Invalid phone number"
            });
        }

        // 6. Check if user already exists
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(409).json({
                message: "User already exists"
            });
        }

        // 7. Hash password (bcrypt + pepper)
        const hashedPassword = await bcrypt.hash(
            password + pepper,
            10
        );

        // 8. Create new user
        // Every new account starts as a renter.
        const user = new User({
            email,
            firstName,
            lastName,
            password: hashedPassword,
            phone,
            roles: ["renter"]
        });

        // 9. Save user to DB
        await user.save();

        // 10. Success response
        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                email: user.email,
                roles: user.roles
            }
        });

    } catch (error) {
        // Handle duplicate email registration
        if (error.code === 11000) {
            return res.status(409).json({
                message: "User already exists"
            });
        }

        console.error("Register error:", error);

        return res.status(500).json({
            message: "User registration failed"
        });
    }
}

// Login User
export async function loginUser(req, res) {
    try {
        let { email, password, rememberme } = req.body;

        // 1. Normalize inputs
        email = email?.trim().toLowerCase();

        // 2. Check required fields
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        // 3. Email format validation (Gmail only)
        const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: "Please enter a valid Gmail address ending in @gmail.com."
            });
        }

        // 4. Password length validation
        if (typeof password !== "string" || password.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters"
            });
        }

        // 5. Find user by email
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // 6. Check if user is blocked
        if (user.isBlocked) {
            return res.status(403).json({
                message: "Your account is blocked. Please contact support for more information."
            });
        }

        // 7. Compare password (bcrypt + pepper)
        const isPasswordValid = await bcrypt.compare(
            password + process.env.PEPPER,
            user.password
        );

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid email or password"
            });
        }

        // 8. Generate JWT token
        const token = jwt.sign(
            {
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: rememberme ? "30d" : "48h"
            }
        );

        // 9. Update last login time
        user.lastLogin = new Date();
        await user.save();

        // 10. Return success response
        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                image: user.image
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            message: "Login failed"
        });
    }
}