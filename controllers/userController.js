import bcrypt from 'bcrypt'
import dotenv from "dotenv"
import User from '../models/userModel.js'

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
        })

    } catch (error) {
        // Server error handling
        return res.status(500).json({
            message: "User registration failed",
            error: error.message
        })
    }
}