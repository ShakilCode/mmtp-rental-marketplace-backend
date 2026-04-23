import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

dotenv.config()

// Middleware: authorizeUser
// This middleware checks if the incoming request
// has a valid JWT token. If yes → user is authorized.
// If not → request continues without user data.
export default function authorizeUser(req, res, next) {

        // Get the Authorization header sent from frontend
        // Example: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6..."
        const header = req.header("Authorization")

        // If a token exists in the header
        if(header != null){

            // there is display somehting like Bearer with the token remove it because out token does not have anything like that
            const token = header.replace("Bearer ", "")

            // decrypt the token
            // here there are 3 values, token, signature, and a arrow function(if decrypt what to do if not what to do)
            jwt.verify(token, process.env.JWT_SECRET, 
                (err, decoded)=>{
                    if(err || decoded == null){
                        res.status(401).json({
                            message : "Invalid token please login again"
                        })
                    }else{
                        // If token is valid:
                        // 'decoded' contains the user data we stored when signing JWT
                        req.user = decoded
                        // Continue to next middleware or route
                        next()
                    }
                }
            )
        }else{
            // If no authorization header is found:
            // Allow request to continue (public routes)
            next()
        }
    }