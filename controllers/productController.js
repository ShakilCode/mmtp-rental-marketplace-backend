import mongoose from "mongoose";
import Product from "../models/Product.js";

// Create Product (Lender only)
export async function addProduct(req, res) {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                message: "Unauthorized - No user found"
            });
        }

        const {
            productId,
            title,
            description,
            category,
            pricePerDay,
            location
        } = req.body;

        // 1. Validate required fields
        const missingFields = [];

        if (!productId?.trim()) missingFields.push("productId");
        if (!title?.trim()) missingFields.push("title");
        if (!description?.trim()) missingFields.push("description");
        if (!category?.trim()) missingFields.push("category");

        if (
            pricePerDay === undefined ||
            pricePerDay === null ||
            pricePerDay === ""
        ) {
            missingFields.push("pricePerDay");
        }

        if (!location?.city?.trim()) {
            missingFields.push("location.city");
        }

        if (missingFields.length > 0) {
            return res.status(400).json({
                message: "Missing required fields",
                missing: missingFields
            });
        }

        // 2. Validate price
        const dailyPrice = Number(pricePerDay);

        if (!Number.isFinite(dailyPrice) || dailyPrice <= 0) {
            return res.status(400).json({
                message: "Price per day must be a number greater than zero"
            });
        }

        // 3. Check duplicate product ID
        const normalizedProductId = productId.trim();

        const existingProduct = await Product.findOne({
            productId: normalizedProductId
        });

        if (existingProduct) {
            return res.status(409).json({
                message: "Product with this productId already exists"
            });
        }

        // 4. Validate optional prices
        const parseOptionalPrice = (value, fieldName) => {
            if (value === undefined || value === null || value === "") {
                return { value: null };
            }

            const number = Number(value);

            if (!Number.isFinite(number) || number < 0) {
                return {
                    error: `${fieldName} must be a non-negative number`
                };
            }

            return { value: number };
        };

        const hourlyPrice = parseOptionalPrice(
            req.body.pricePerHour,
            "pricePerHour"
        );

        const previousPrice = parseOptionalPrice(
            req.body.oldPrice,
            "oldPrice"
        );

        const deposit = parseOptionalPrice(
            req.body.deposit,
            "deposit"
        );

        for (const result of [hourlyPrice, previousPrice, deposit]) {
            if (result.error) {
                return res.status(400).json({
                    message: result.error
                });
            }
        }

        // 5. Validate availability dates
        const startDate = req.body.availability?.startDate || null;
        const endDate = req.body.availability?.endDate || null;

        if (
            startDate &&
            Number.isNaN(Date.parse(startDate))
        ) {
            return res.status(400).json({
                message: "Invalid availability start date"
            });
        }

        if (
            endDate &&
            Number.isNaN(Date.parse(endDate))
        ) {
            return res.status(400).json({
                message: "Invalid availability end date"
            });
        }

        if (
            startDate &&
            endDate &&
            new Date(startDate) > new Date(endDate)
        ) {
            return res.status(400).json({
                message: "End date must be after start date"
            });
        }

        // 6. Build trusted product data
        // Never accept owner or approvalStatus from the request body.
        const productData = {
            productId: normalizedProductId,
            title: title.trim(),
            description: description.trim(),
            category: category.trim(),
            pricePerDay: dailyPrice,
            pricePerHour: hourlyPrice.value,
            oldPrice: previousPrice.value,
            deposit: deposit.value ?? 0,

            altNames: Array.isArray(req.body.altNames)
                ? req.body.altNames
                : [],

            images: Array.isArray(req.body.images) &&
                req.body.images.length > 0
                ? req.body.images
                : ["/images/default-product.png"],

            // A lender cannot change the approval status.
            // Every new submission starts as pending.
            approvalStatus: "pending",
            reviewedBy: null,
            reviewedAt: null,
            rejectionReason: "",

            isAvailable: true,

            condition: req.body.condition || "good",

            availability: {
                startDate,
                endDate
            },

            owner: user.id || user._id,

            location: {
                city: location.city.trim(),
                district: location.district?.trim() || "",
                country: location.country?.trim() || "Sri Lanka"
            }
        };

        if (!productData.owner) {
            return res.status(401).json({
                message: "Unable to identify the logged-in user"
            });
        }

        // 7. Save product for the lender
        const newProduct = await Product.create(productData);

        return res.status(201).json({
            message: "Product submitted successfully. Waiting for admin approval.",
            product: newProduct
        });

    } catch (error) {
        // MongoDB unique index protection against duplicate IDs
        if (error.code === 11000) {
            return res.status(409).json({
                message: "Product with this productId already exists"
            });
        }

        console.error("Add product error:", error);

        return res.status(500).json({
            message: "Error creating product"
        });
    }
}


// View products submitted by the logged-in lender
export async function getMyProducts(req, res) {
    try {
        const userId = req.user.id || req.user._id;

        const products = await Product.find({
            owner: userId
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            count: products.length,
            products
        });

    } catch (error) {
        console.error("Get lender products error:", error);

        return res.status(500).json({
            message: "Error retrieving your products"
        });
    }
}


// View approved products for the renter marketplace
export async function getPublicProducts(req, res) {
    try {
        const products = await Product.find({
            approvalStatus: "approved",
            isAvailable: true
        }).sort({ createdAt: -1 });

        return res.status(200).json({
            count: products.length,
            products
        });

    } catch (error) {
        console.error("Get public products error:", error);

        return res.status(500).json({
            message: "Error retrieving products"
        });
    }
}


// View pending products for admin review
export async function getPendingProducts(req, res) {
    try {
        const products = await Product.find({
            $or: [
                { approvalStatus: "pending" },
                { pendingChanges: { $ne: null } }
            ]
        })
            .populate("owner", "firstName lastName email")
            .sort({ createdAt: 1 });

        return res.status(200).json({
            count: products.length,
            products
        });

    } catch (error) {
        console.error("Get pending products error:", error);

        return res.status(500).json({
            message: "Error retrieving pending products"
        });
    }
}


// Admin approves or rejects a product
export async function reviewProduct(req, res) {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        // 1. Validate the requested decision
        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({
                message: "Status must be approved or rejected"
            });
        }

        // 2. Validate product ID
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid product ID"
            });
        }

        // 3. Find product
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        const adminId = req.user.id || req.user._id;

        // 4. Handle an update to an already-approved product
        if (product.pendingChanges !== null) {
            if (product.approvalStatus !== "approved") {
                return res.status(409).json({
                    message: "Product is not in a valid state for update review"
                });
            }

            if (status === "approved") {
                // Apply the proposed fields to the public product
                const changes = product.pendingChanges.toObject
                    ? product.pendingChanges.toObject()
                    : product.pendingChanges;

                for (const [field, value] of Object.entries(changes)) {
                    product.set(field, value);
                }

                product.reviewedBy = adminId;
                product.reviewedAt = new Date();
                product.rejectionReason = "";
                product.pendingChanges = null;

                await product.save();

                return res.status(200).json({
                    message: "Product update approved and applied successfully",
                    product
                });
            }

            // Reject only the proposed changes.
            // Keep the original approved product available.
            product.pendingChanges = null;
            product.reviewedBy = adminId;
            product.reviewedAt = new Date();
            product.rejectionReason =
                typeof rejectionReason === "string" &&
                rejectionReason.trim()
                    ? rejectionReason.trim()
                    : "Product update rejected without a reason";

            await product.save();

            return res.status(200).json({
                message: "Product update rejected. The previously approved product remains unchanged.",
                product
            });
        }

        // 5. Handle a new product awaiting its first review
        if (product.approvalStatus !== "pending") {
            return res.status(409).json({
                message: "Product is not awaiting initial approval"
            });
        }

        product.approvalStatus = status;
        product.reviewedBy = adminId;
        product.reviewedAt = new Date();

        product.rejectionReason =
            status === "rejected"
                ? (
                    typeof rejectionReason === "string" &&
                    rejectionReason.trim()
                        ? rejectionReason.trim()
                        : "No reason provided"
                )
                : "";

        await product.save();

        return res.status(200).json({
            message: `Product ${status} successfully`,
            product
        });

    } catch (error) {
        console.error("Review product error:", error);

        return res.status(500).json({
            message: "Failed to review product"
        });
    }
}


// Update Product (Lender only)
// Stores proposed changes until admin approval
export async function updateProduct(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id || req.user._id;

        // 1. Validate product ID
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid product ID"
            });
        }

        // 2. Find product owned by the logged-in lender
        const product = await Product.findOne({
            _id: id,
            owner: userId
        });

        if (!product) {
            return res.status(404).json({
                message: "Product not found or you do not own this product"
            });
        }

        // 3. Only approved products can be updated
        if (product.approvalStatus !== "approved") {
            return res.status(400).json({
                message: "Only approved products can be updated"
            });
        }

        // 4. Prevent multiple submissions while changes are pending
        if (product.pendingChanges !== null) {
            return res.status(409).json({
                message: "Your previous product update is awaiting admin review"
            });
        }

        // 5. Only allow editable fields
        // productId, owner, approvalStatus, reviewedBy and
        // reviewedAt cannot be changed by the lender.
        const allowedFields = [
            "title",
            "description",
            "altNames",
            "category",
            "pricePerDay",
            "pricePerHour",
            "oldPrice",
            "deposit",
            "availability",
            "location",
            "images",
            "isAvailable",
            "condition"
        ];

        const updates = {};

        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updates[field] = req.body[field];
            }
        }

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                message: "No valid product fields provided for update"
            });
        }

        // 6. Validate text fields
        for (const field of ["title", "description", "category"]) {
            if (field in updates) {
                if (
                    typeof updates[field] !== "string" ||
                    !updates[field].trim()
                ) {
                    return res.status(400).json({
                        message: `${field} must be a non-empty string`
                    });
                }

                updates[field] = updates[field].trim();
            }
        }

        // 7. Validate prices
        for (const field of [
            "pricePerDay",
            "pricePerHour",
            "oldPrice",
            "deposit"
        ]) {
            if (!(field in updates)) continue;

            const value = updates[field];

            if (
                value === null &&
                ["pricePerHour", "oldPrice"].includes(field)
            ) {
                continue;
            }

            if (
                value === "" ||
                value === null ||
                value === undefined ||
                !Number.isFinite(Number(value)) ||
                Number(value) < 0
            ) {
                return res.status(400).json({
                    message: `${field} must be a non-negative number`
                });
            }

            updates[field] = Number(value);
        }

        if (
            "pricePerDay" in updates &&
            updates.pricePerDay <= 0
        ) {
            return res.status(400).json({
                message: "Price per day must be greater than zero"
            });
        }

        // 8. Validate alternative names
        if ("altNames" in updates) {
            if (
                !Array.isArray(updates.altNames) ||
                !updates.altNames.every(
                    name => typeof name === "string"
                )
            ) {
                return res.status(400).json({
                    message: "altNames must be an array of strings"
                });
            }

            updates.altNames = updates.altNames
                .map(name => name.trim())
                .filter(Boolean);
        }

        // 9. Validate images
        if ("images" in updates) {
            if (
                !Array.isArray(updates.images) ||
                !updates.images.every(
                    image => typeof image === "string" && image.trim()
                )
            ) {
                return res.status(400).json({
                    message: "images must be an array of non-empty strings"
                });
            }

            updates.images = updates.images.map(image => image.trim());
        }

        // 10. Validate availability dates
        if ("availability" in updates) {
            const availability = updates.availability;

            if (
                !availability ||
                typeof availability !== "object" ||
                Array.isArray(availability)
            ) {
                return res.status(400).json({
                    message: "Invalid availability object"
                });
            }

            const startDate = availability.startDate || null;
            const endDate = availability.endDate || null;

            for (const [field, value] of [
                ["startDate", startDate],
                ["endDate", endDate]
            ]) {
                if (
                    value !== null &&
                    (
                        typeof value !== "string" &&
                        !(value instanceof Date)
                    )
                ) {
                    return res.status(400).json({
                        message: `Invalid availability ${field}`
                    });
                }

                if (
                    value !== null &&
                    Number.isNaN(Date.parse(value))
                ) {
                    return res.status(400).json({
                        message: `Invalid availability ${field}`
                    });
                }
            }

            if (
                startDate &&
                endDate &&
                new Date(startDate) > new Date(endDate)
            ) {
                return res.status(400).json({
                    message: "End date must be after start date"
                });
            }

            updates.availability = {
                startDate,
                endDate
            };
        }

        // 11. Validate location
        if ("location" in updates) {
            const location = updates.location;

            if (
                !location ||
                typeof location !== "object" ||
                Array.isArray(location) ||
                typeof location.city !== "string" ||
                !location.city.trim()
            ) {
                return res.status(400).json({
                    message: "A valid location.city is required"
                });
            }

            for (const field of ["district", "country"]) {
                if (
                    location[field] !== undefined &&
                    typeof location[field] !== "string"
                ) {
                    return res.status(400).json({
                        message: `location.${field} must be a string`
                    });
                }
            }

            updates.location = {
                city: location.city.trim(),
                district: location.district?.trim() || "",
                country: location.country?.trim() || "Sri Lanka"
            };
        }

        // 12. Validate availability toggle
        if (
            "isAvailable" in updates &&
            typeof updates.isAvailable !== "boolean"
        ) {
            return res.status(400).json({
                message: "isAvailable must be a boolean"
            });
        }

        // 13. Validate condition
        if ("condition" in updates) {
            const validConditions = [
                "new",
                "like new",
                "good",
                "used"
            ];

            if (!validConditions.includes(updates.condition)) {
                return res.status(400).json({
                    message: "Invalid product condition"
                });
            }
        }

        // 14. Store the proposed version, not the public version
        product.pendingChanges = updates;
        await product.save();

        return res.status(200).json({
            message: "Product update submitted successfully. Waiting for admin approval.",
            product
        });

    } catch (error) {
        console.error("Update product error:", error);

        return res.status(500).json({
            message: "Error submitting product update"
        });
    }
}
