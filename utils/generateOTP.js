import crypto from "crypto";

// Generate a secure six-digit OTP.
export function generateOTP() {
    return crypto.randomInt(100000, 1000000).toString();
}

// Hash the OTP before storing it in MongoDB.
export function hashOTP(otp) {
    return crypto
        .createHash("sha256")
        .update(otp)
        .digest("hex");
}

// Generate a random trusted device token.
export function generateDeviceToken() {
    return crypto.randomBytes(32).toString("hex");
}

// Hash the trusted device token before storing it.
export function hashDeviceToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}