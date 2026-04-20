import express from 'express'
import { registerUser } from '../controllers/userController.js'

// Create a new router object
const userRouter = express.Router()

userRouter.post("/register", registerUser)


// Export router so index.js can use it
export default userRouter