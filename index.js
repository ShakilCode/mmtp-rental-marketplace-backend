// Import the express.js framework
import express from 'express';
// Import the dotenv
import dotenv from 'dotenv'
// Import the mongoose to connect backend to the MongoDB
import mongoose from 'mongoose'
import userRouter from './router/userRouter.js';
import authorizeUser from './lib/jwtMiddleware.js';

// reads .env file and loads values into process.env
dotenv.config()

// MongoDB URI
const mongoURI = process.env.MONGO_URI

// connect our backend with the MongoDB
mongoose.connect(mongoURI).then(
    ()=>{
        console.log("Connected to MongoDB")
    }
).catch(
    ()=>{
        console.log("Error connecting to MongoDB")
    }
)

// Assign the express backend to a variable 
const app = express()

// Body Parser (middleware)
app.use(express.json())

// middleware for check jwt token
app.use(authorizeUser)

// Connect the user router
app.use("/api/users", userRouter)

// Start the server and make it listed for incoming requests on a specified port
app.listen(process.env.PORT,
    // Arrow function
    ()=>{
        console.log("Server is running perfectly")
    }
)