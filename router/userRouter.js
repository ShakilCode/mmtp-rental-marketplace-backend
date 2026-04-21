import express from 'express'
import { loginUser, registerUser } from '../controllers/userController.js'

// Create a new router object
const userRouter = express.Router()

userRouter.post("/register", registerUser)
userRouter.post("/login", loginUser)


// Export router so index.js can use it
export default userRouter