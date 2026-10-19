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
        let { email, firstName, lastName, password, confirmPassword, phone, role } = req.body
 
        // Trim + normalize inputs
        email = email?.trim().toLowerCase()
        firstName = firstName?.trim()
        lastName = lastName?.trim()
        phone = phone?.trim()
 
        // Allowed roles (NO ADMIN from frontend)
        const allowedRoles = ["renter", "lender"]
 
        // Force safe role
        if (!allowedRoles.includes(role)) {
            role = "renter"
        }
 
        // 1. Check required fields
        if (!email || !firstName || !lastName || !password || !confirmPassword || !phone) {
            return res.status(400).json({
                message: "All fields are required"
            })
        }
 
        // 2. Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: "Invalid email format"
            })
        }
 
        // 3. Password match check
        if (password !== confirmPassword) {
            return res.status(400).json({
                message: "Passwords do not match"
            })
        }
 
        // 4. Strong password rule (uses the shared helper)
        const passwordErrors = validatePassword(password)
        if (passwordErrors.length > 0) {
            return res.status(400).json({
                message: `Password must contain ${passwordErrors.join(", ")}.`
            })
        }
 
        // 5. Phone validation
        if (!/^\d{10,15}$/.test(phone)) {
            return res.status(400).json({
                message: "Invalid phone number"
            })
        }
 
        // 6. Check if user already exists
        const existingUser = await User.findOne({ email })
 
        if (existingUser) {
            return res.status(409).json({
                message: "User already exists"
            })
        }
 
        // 7. Hash password (bcrypt + pepper)
        const hashedPassword = await bcrypt.hash(password + pepper, 10)
 
        // 8. Create new user
        // A lender can also rent, so lenders get both roles
        const user = new User({
            email,
            firstName,
            lastName,
            password: hashedPassword,
            phone,
            roles: role === "lender" ? ["renter", "lender"] : ["renter"]
        })
 
        // 9. Save user to DB
        await user.save()
 
        // Success response
        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                email: user.email,
                roles: user.roles
            }
        })
 
    } catch (error) {
        // Two requests with the same email at the same time
        if (error.code === 11000) {
            return res.status(409).json({
                message: "User already exists"
            })
        }
 
        console.error("Register error:", error)
 
        // Don't send error.message to the client
        return res.status(500).json({
            message: "User registration failed"
        })
    }
}

// Login User
export async function loginUser(req, res) {
    try {
        let { email, password, rememberme } = req.body

        // 1️ Normalize inputs
        email = email?.trim().toLowerCase()
        password = password?.trim()

        // 2️ Check required fields
        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            })
        }

        // 3️ Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: "Invalid email format"
            })
        }

        // 4️ Password basic check (min 6 chars)
        if (password.length < 6) {
            return res.status(400).json({
                message: "Password must be at least 6 characters"
            })
        }

        // 5️ Find user
        const user = await User.findOne({ email })

        if (!user) {
            return res.status(401).json({
                message: "User with given email not found"
            })
        }

        // 6️ Check if user is blocked
        if (user.isBlocked) {
            return res.status(403).json({
                message: "Your account is blocked. Please contact support for more information."
            })
        }

        // 7️ Compare password (WITH pepper ⚠️)
        const isPasswordValid = await bcrypt.compare(
            password + process.env.PEPPER,
            user.password
        )

        if (!isPasswordValid) {
            return res.status(401).json({
                message: "Invalid password"
            })
        }

        // 8️ Generate JWT token
        const token = jwt.sign(
            {
                id: user._id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            {
                expiresIn: rememberme ? "30d" : "48h"
            }
        )

        // 9️ Success response
        return res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                email: user.email,
                role: user.role
            }
        })

    } catch (error) {
        return res.status(500).json({
            message: "Login failed",
            error: error.message
        })
    }
}