import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Create a transporter for sending MMTP emails through Gmail.
const transporter = nodemailer.createTransport({
    service: "gmail",

    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
    },
});

// Verify the Gmail connection when the server starts.
export async function verifyEmailConnection() {
    try {
        await transporter.verify();
        console.log("Email server is ready");
    } catch (error) {
        console.error("Email server connection failed:", error.message);
    }
}

// Export the transporter for controllers to use.
export default transporter;