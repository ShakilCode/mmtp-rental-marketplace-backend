import supabase from "../config/supabase.js";
import { randomUUID } from "crypto";
import { fileTypeFromBuffer } from "file-type";

export const uploadProductImages = async (req, res) => {
    const bucket = process.env.SUPABASE_BUCKET;
    const uploadedPaths = [];

    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                message: "Please select at least one image."
            });
        }

        const allowedTypes = {
            jpg: "image/jpeg",
            png: "image/png",
            webp: "image/webp"
        };

        // Validate actual file contents
        for (const file of req.files) {
            const detectedType = await fileTypeFromBuffer(file.buffer);

            if (
                !detectedType ||
                !allowedTypes[detectedType.ext] ||
                allowedTypes[detectedType.ext] !== detectedType.mime
            ) {
                return res.status(400).json({
                    message: "Only valid JPEG, PNG and WebP images are allowed."
                });
            }

            file.detectedType = detectedType;
        }

        const imageUrls = [];

        // Upload validated images
        for (const file of req.files) {
            const fileName = `${randomUUID()}.${file.detectedType.ext}`;
            const filePath = `products/${fileName}`;

            const { error } = await supabase.storage
                .from(bucket)
                .upload(filePath, file.buffer, {
                    contentType: file.detectedType.mime,
                    cacheControl: "3600",
                    upsert: false
                });

            if (error) {
                throw error;
            }

            uploadedPaths.push(filePath);

            const { data } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);

            imageUrls.push(data.publicUrl);
        }

        return res.status(200).json({
            message: "Images uploaded successfully.",
            images: imageUrls
        });

    } catch (error) {
        console.error("Image upload error:", error);

        // Remove images already uploaded if the request fails
        if (uploadedPaths.length > 0) {
            await supabase.storage
                .from(bucket)
                .remove(uploadedPaths);
        }

        return res.status(500).json({
            message: "Failed to upload images."
        });
    }
};