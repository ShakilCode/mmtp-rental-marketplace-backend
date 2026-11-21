import multer from "multer";

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 10
    },
    fileFilter: (req, file, callback) => {
        const allowedTypes = [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];

        if (!allowedTypes.includes(file.mimetype)) {
            return callback(
                new Error("Only JPEG, PNG and WebP images are allowed.")
            );
        }

        callback(null, true);
    }
});

export const uploadProductImages = (req, res, next) => {
    upload.array("images", 10)(req, res, (error) => {
        if (error) {
            return res.status(400).json({
                message: error.message
            });
        }

        next();
    });
};