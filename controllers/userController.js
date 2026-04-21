import bcrypt from 'bcrypt'
import dotenv from "dotenv"
import User from '../models/userModel.js'
// JWT (JSON Web Token) is used for login authentication
import jwt from 'jsonwebtoken'

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

        // 1️ Check required fields
        if (!email || !firstName || !lastName || !password || !confirmPassword || !phone) {
            return res.status(400).json({
                message: "All fields are required"
            })
        }

        // 2️ Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: "Invalid email format"
            })
        }

        // 3️ Password match check
        if (password !== confirmPassword) {
            return res.status(400).json({
                message: "Passwords do not match"
            })
        }

        // 4️ Strong password rule (letters + numbers, min 6 chars)
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/
        if (!passwordRegex.test(password)) {
            return res.status(400).json({
                message: "Password must be at least 6 characters and contain letters and numbers"
            })
        }

        // 5️ Phone validation
        if (!/^\d{10,15}$/.test(phone)) {
            return res.status(400).json({
                message: "Invalid phone number"
            })
        }

        // 6️ Check if user already exists
        const existingUser = await User.findOne({ email })

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists"
            })
        }

        // 7️ Hash password (bcrypt + pepper)
        const hashedPassword = await bcrypt.hash(password + pepper, 10)

        // 8️ Create new user
        const user = new User({
            email,
            firstName,
            lastName,
            password: hashedPassword,
            phone,
            role 
        })

        // 9️ Save user to DB
        await user.save()

        // Success response
        return res.status(201).json({
            message: "User registered successfully",
            user: {
                id: user._id,
                email: user.email,
                role: user.role
            }
        })

    } catch (error) {
        // Server error handling
        return res.status(500).json({
            message: "User registration failed",
            error: error.message
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