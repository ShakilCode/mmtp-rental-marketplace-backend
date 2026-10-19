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
            approvalStatus: "pending"
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
        // Get the product ID from the URL
        const { id } = req.params;

        // Get the admin's decision from the request body
        const { status, rejectionReason } = req.body;

        // Only allow approved or rejected status
        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({
                message: "Status must be approved or rejected"
            });
        }

        // Find the product
        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        // Update the review decision
        product.approvalStatus = status;

        // Record which admin reviewed the product
        product.reviewedBy = req.user.id || req.user._id;

        // Record the review date
        product.reviewedAt = new Date();

        // Save a rejection reason only when rejecting
        product.rejectionReason =
            status === "rejected"
                ? (rejectionReason?.trim() || "No reason provided")
                : "";

        await product.save();

        return res.status(200).json({
            message: `Product ${status} successfully`,
            product
        });

    } catch (error) {
        console.error("Review product error:", error);

        return res.status(500).json({
            message: "Failed to review product",
            error: error.message
        });
    }
}

