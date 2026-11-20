import mongoose from "mongoose";
import { randomBytes } from "crypto";

import Product from "../models/product.js";
import User from "../models/userModel.js";

// Valid product conditions
const VALID_CONDITIONS = [
    "new",
    "like new",
    "good",
    "used",
];

// Valid product statuses
const VALID_STATUSES = [
    "approved",
    "rejected",
    "suspended",
];

// Fields lenders are allowed to edit
const EDITABLE_FIELDS = [
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
    "condition",
];

// Get authenticated user ID
function getUserId(user) {
    return user?.id || user?._id;
}

// Escape special characters in search
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Generate unique product ID
async function generateProductId() {
    let productId;

    do {
        productId = `MMTP-${randomBytes(4)
            .toString("hex")
            .toUpperCase()}`;

    } while (
        await Product.exists({ productId })
    );

    return productId;
}

// Add moderation history
function addHistory(
    product,
    action,
    actor,
    note = "",
    fromStatus = null,
    toStatus = null
) {
    product.moderationHistory.push({
        action,
        actor,
        note,
        fromStatus,
        toStatus,
        at: new Date(),
    });
}

// Validate dates
function validateDate(value, fieldName) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return {
            value: null,
        };
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return {
            error: `${fieldName} is invalid`,
        };
    }

    return {
        value: date,
    };
}

// Validate and sanitize product data
function validateProductData(body, partial = false) {
    const data = {};
    const errors = [];

    // Required fields for new products
    if (!partial) {
        for (const field of [
            "title",
            "description",
            "category",
            "pricePerDay",
        ]) {
            if (
                body[field] === undefined ||
                body[field] === null ||
                body[field] === ""
            ) {
                errors.push(`${field} is required`);
            }
        }

        if (!body.location?.city) {
            errors.push("location.city is required");
        }
    }

    // Validate text fields
    for (const field of [
        "title",
        "description",
        "category",
    ]) {
        if (!(field in body)) continue;

        if (
            typeof body[field] !== "string" ||
            !body[field].trim()
        ) {
            errors.push(
                `${field} must be a valid string`
            );
            continue;
        }

        data[field] = body[field].trim();
    }

    // Validate text length
    if (data.title && data.title.length > 150) {
        errors.push(
            "Title cannot exceed 150 characters"
        );
    }

    if (
        data.description &&
        data.description.length > 5000
    ) {
        errors.push(
            "Description cannot exceed 5000 characters"
        );
    }

    if (
        data.category &&
        data.category.length > 100
    ) {
        errors.push(
            "Category cannot exceed 100 characters"
        );
    }

    // Validate prices
    for (const field of [
        "pricePerDay",
        "pricePerHour",
        "oldPrice",
        "deposit",
    ]) {
        if (!(field in body)) continue;

        const value = body[field];

        // Optional prices can be null
        if (
            value === null &&
            ["pricePerHour", "oldPrice"].includes(field)
        ) {
            data[field] = null;
            continue;
        }

        if (
            value === "" ||
            value === undefined ||
            !Number.isFinite(Number(value)) ||
            Number(value) < 0
        ) {
            errors.push(
                `${field} must be a valid non-negative number`
            );
            continue;
        }

        data[field] = Number(value);
    }

    // Daily rental price must be greater than zero
    if (
        "pricePerDay" in data &&
        data.pricePerDay <= 0
    ) {
        errors.push(
            "pricePerDay must be greater than zero"
        );
    }

    // Validate alternative names
    if ("altNames" in body) {
        if (
            !Array.isArray(body.altNames) ||
            !body.altNames.every(
                name => typeof name === "string"
            )
        ) {
            errors.push(
                "altNames must be an array of strings"
            );
        } else {
            data.altNames = body.altNames
                .map(name => name.trim())
                .filter(Boolean)
                .slice(0, 20);
        }
    }

    // Validate images
    if ("images" in body) {
        if (
            !Array.isArray(body.images) ||
            !body.images.every(
                image =>
                    typeof image === "string" &&
                    image.trim().length > 0 &&
                    (
                        image.trim().startsWith("/images/") ||
                        image.trim().startsWith("https://")
                    )
            )
        ) {
            errors.push(
                "Images must contain valid HTTPS URLs or local image paths"
            );
        } else {
            data.images = body.images
                .map(image => image.trim())
                .slice(0, 10);
        }
    }

    // Validate availability dates
    if ("availability" in body) {
        const availability = body.availability;

        if (
            !availability ||
            typeof availability !== "object" ||
            Array.isArray(availability)
        ) {
            errors.push(
                "Invalid availability object"
            );
        } else {
            const start = validateDate(
                availability.startDate,
                "Availability start date"
            );

            const end = validateDate(
                availability.endDate,
                "Availability end date"
            );

            if (start.error) errors.push(start.error);
            if (end.error) errors.push(end.error);

            if (
                start.value &&
                end.value &&
                start.value > end.value
            ) {
                errors.push(
                    "Availability end date must be after start date"
                );
            }

            if (!start.error && !end.error) {
                data.availability = {
                    startDate: start.value,
                    endDate: end.value,
                };
            }
        }
    }

    // Validate location
    if ("location" in body) {
        const location = body.location;

        if (
            !location ||
            typeof location !== "object" ||
            Array.isArray(location) ||
            typeof location.city !== "string" ||
            !location.city.trim()
        ) {
            errors.push(
                "A valid location.city is required"
            );
        } else {
            data.location = {
                city: location.city.trim(),

                district:
                    typeof location.district === "string"
                        ? location.district.trim()
                        : "",

                country:
                    typeof location.country === "string" &&
                    location.country.trim()
                        ? location.country.trim()
                        : "Sri Lanka",
            };
        }
    }

    // Validate availability
    if ("isAvailable" in body) {
        if (
            typeof body.isAvailable !== "boolean"
        ) {
            errors.push(
                "isAvailable must be a boolean"
            );
        } else {
            data.isAvailable = body.isAvailable;
        }
    }

    // Validate condition
    if ("condition" in body) {
        if (
            !VALID_CONDITIONS.includes(body.condition)
        ) {
            errors.push(
                "Invalid product condition"
            );
        } else {
            data.condition = body.condition;
        }
    }

    // Reject unexpected fields
    for (const field of Object.keys(body)) {
        if (!EDITABLE_FIELDS.includes(field)) {
            errors.push(
                `Field '${field}' is not allowed`
            );
        }
    }

    return {
        data,
        errors,
    };
}



// LENDER: CREATE PRODUCT
export async function addProduct(req, res) {
    try {
        const ownerId = getUserId(req.user);

        if (!ownerId) {
            return res.status(401).json({
                message: "Authentication required",
            });
        }

        // Validate product information
        const { data, errors } = validateProductData(
            req.body,
            false
        );

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Product validation failed",
                errors,
            });
        }

        // Confirm that the logged-in user is a lender
        const lender = await User.findById(ownerId)
            .select("role isBlocked");

        if (!lender) {
            return res.status(401).json({
                message: "User account not found",
            });
        }

        if (lender.isBlocked) {
            return res.status(403).json({
                message: "Your account is blocked",
            });
        }

        if (lender.role !== "lender") {
            return res.status(403).json({
                message: "Only lenders can submit products",
            });
        }

        // Generate a product ID on the backend
        const productId = await generateProductId();

        // Create the product
        const product = await Product.create({
            ...data,

            productId,

            owner: ownerId,

            approvalStatus: "pending",

            reviewedBy: null,
            reviewedAt: null,

            rejectionReason: "",

            pendingChanges: null,
            pendingUpdateStatus: null,

            pendingUpdateRejectionReason: "",
            pendingUpdateReviewedBy: null,
            pendingUpdateReviewedAt: null,

            isAvailable: true,
            isDeleted: false,

            images:
                data.images?.length > 0
                    ? data.images
                    : ["/images/default-product.png"],

            deposit: data.deposit ?? 0,

            condition: data.condition || "good",

            availability: data.availability || {
                startDate: null,
                endDate: null,
            },

            location: data.location,

            moderationHistory: [
                {
                    action: "product-submitted",
                    actor: ownerId,
                    note: "Initial product submission",
                    fromStatus: null,
                    toStatus: "pending",
                    at: new Date(),
                },
            ],
        });

        return res.status(201).json({
            message: "Product submitted successfully. Waiting for admin approval.",
            product,
        });

    } catch (error) {
        console.error("Add product error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "Duplicate product reference",
            });
        }

        return res.status(500).json({
            message: "Error creating product",
        });
    }
}



// LENDER: VIEW OWN PRODUCTS
export async function getMyProducts(req, res) {
    try {
        const ownerId = getUserId(req.user);

        const products = await Product.find({
            owner: ownerId,
            isDeleted: false,
        })
            .sort({ createdAt: -1 })
            .lean();

        return res.status(200).json({
            count: products.length,
            products,
        });

    } catch (error) {
        console.error("Get lender products error:", error);

        return res.status(500).json({
            message: "Error retrieving your products",
        });
    }
}



// LENDER: VIEW ONE OF THEIR PRODUCTS
export async function getMyProductById(req, res) {
    try {
        const { id } = req.params;
        const ownerId = getUserId(req.user);

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const product = await Product.findOne({
            _id: id,
            owner: ownerId,
            isDeleted: false,
        });

        if (!product) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        return res.status(200).json({
            product,
        });

    } catch (error) {
        console.error("Get lender product error:", error);

        return res.status(500).json({
            message: "Error retrieving product",
        });
    }
}



// PUBLIC: VIEW APPROVED PRODUCTS
export async function getPublicProducts(req, res) {
    try {
        const {
            search,
            category,
            city,
            district,
            minPrice,
            maxPrice,
            page = 1,
            limit = 12,
        } = req.query;

        // Pagination
        const currentPage = Math.max(
            1,
            Number.parseInt(page, 10) || 1
        );

        const pageSize = Math.min(
            50,
            Math.max(
                1,
                Number.parseInt(limit, 10) || 12
            )
        );

        // Only approved products can appear publicly
        const filter = {
            approvalStatus: "approved",
            isAvailable: true,
            isDeleted: false,
        };

        // Search products
        if (
            typeof search === "string" &&
            search.trim()
        ) {
            const regex = new RegExp(
                escapeRegex(search.trim()),
                "i"
            );

            filter.$or = [
                { title: regex },
                { description: regex },
                { altNames: regex },
            ];
        }

        if (category) {
            filter.category = category;
        }

        if (city) {
            filter["location.city"] = new RegExp(
                `^${escapeRegex(city)}$`,
                "i"
            );
        }

        if (district) {
            filter["location.district"] = new RegExp(
                `^${escapeRegex(district)}$`,
                "i"
            );
        }

        // Validate price filters
        if (
            minPrice !== undefined &&
            (
                !Number.isFinite(Number(minPrice)) ||
                Number(minPrice) < 0
            )
        ) {
            return res.status(400).json({
                message: "Invalid minimum price",
            });
        }

        if (
            maxPrice !== undefined &&
            (
                !Number.isFinite(Number(maxPrice)) ||
                Number(maxPrice) < 0
            )
        ) {
            return res.status(400).json({
                message: "Invalid maximum price",
            });
        }

        // Apply price range
        if (
            minPrice !== undefined ||
            maxPrice !== undefined
        ) {
            filter.pricePerDay = {};

            if (minPrice !== undefined) {
                filter.pricePerDay.$gte =
                    Number(minPrice);
            }

            if (maxPrice !== undefined) {
                filter.pricePerDay.$lte =
                    Number(maxPrice);
            }
        }

        const [products, total] = await Promise.all([
            Product.find(filter)
                .select(
                    "-moderationHistory -pendingChanges -rejectionReason -reviewedBy"
                )
                .sort({ createdAt: -1 })
                .skip((currentPage - 1) * pageSize)
                .limit(pageSize)
                .lean(),

            Product.countDocuments(filter),
        ]);

        return res.status(200).json({
            count: products.length,
            total,
            page: currentPage,
            pages: Math.ceil(total / pageSize),
            products,
        });

    } catch (error) {
        console.error("Get public products error:", error);

        return res.status(500).json({
            message: "Error retrieving products",
        });
    }
}



// PUBLIC: VIEW ONE APPROVED PRODUCT
export async function getPublicProductById(req, res) {
    try {
        const { id } = req.params;

        const conditions = [
            {
                productId: id,
            },
        ];

        if (mongoose.isValidObjectId(id)) {
            conditions.push({
                _id: id,
            });
        }

        const product = await Product.findOne({
            $or: conditions,

            approvalStatus: "approved",
            isAvailable: true,
            isDeleted: false,
        })
            .select(
                "-moderationHistory -pendingChanges -rejectionReason -reviewedBy"
            )
            .lean();

        if (!product) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        return res.status(200).json({
            product,
        });

    } catch (error) {
        console.error("Get public product error:", error);

        return res.status(500).json({
            message: "Error retrieving product",
        });
    }
}



// ADMIN: VIEW PENDING PRODUCTS
export async function getPendingProducts(req, res) {
    try {
        const products = await Product.find({
            isDeleted: false,

            $or: [
                {
                    approvalStatus: "pending",
                },
                {
                    pendingChanges: { $ne: null },
                    pendingUpdateStatus: "pending",
                },
            ],
        })
            .populate(
                "owner",
                "firstName lastName email phone isPhoneVerified role"
            )
            .sort({ createdAt: 1 });

        return res.status(200).json({
            count: products.length,
            products,
        });

    } catch (error) {
        console.error("Get pending products error:", error);

        return res.status(500).json({
            message: "Error retrieving pending products",
        });
    }
}



// ADMIN: VIEW AND SEARCH ALL PRODUCTS
export async function getAdminProducts(req, res) {
    try {
        const {
            search,
            status,
            category,
            includeDeleted = "false",
            page = 1,
            limit = 20,
        } = req.query;

        const currentPage = Math.max(
            1,
            Number.parseInt(page, 10) || 1
        );

        const pageSize = Math.min(
            100,
            Math.max(
                1,
                Number.parseInt(limit, 10) || 20
            )
        );

        const filter = {};

        if (includeDeleted !== "true") {
            filter.isDeleted = false;
        }

        if (status) {
            if (
                ![
                    "pending",
                    "approved",
                    "rejected",
                    "suspended",
                ].includes(status)
            ) {
                return res.status(400).json({
                    message: "Invalid product status",
                });
            }

            filter.approvalStatus = status;
        }

        if (category) {
            filter.category = category;
        }

        // Admin search
        if (
            typeof search === "string" &&
            search.trim()
        ) {
            const regex = new RegExp(
                escapeRegex(search.trim()),
                "i"
            );

            filter.$or = [
                { title: regex },
                { productId: regex },
                { category: regex },
                { "location.city": regex },
            ];
        }

        const [products, total] = await Promise.all([
            Product.find(filter)
                .populate(
                    "owner",
                    "firstName lastName email phone isPhoneVerified role isBlocked"
                )
                .populate(
                    "reviewedBy",
                    "firstName lastName email"
                )
                .sort({ createdAt: -1 })
                .skip((currentPage - 1) * pageSize)
                .limit(pageSize),

            Product.countDocuments(filter),
        ]);

        return res.status(200).json({
            count: products.length,
            total,
            page: currentPage,
            pages: Math.ceil(total / pageSize),
            products,
        });

    } catch (error) {
        console.error("Get admin products error:", error);

        return res.status(500).json({
            message: "Error retrieving products",
        });
    }
}



// ADMIN: VIEW ONE PRODUCT
export async function getAdminProductById(req, res) {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const product = await Product.findById(id)
            .populate(
                "owner",
                "firstName lastName email phone isPhoneVerified role isBlocked"
            )
            .populate(
                "reviewedBy",
                "firstName lastName email"
            )
            .populate(
                "pendingUpdateReviewedBy",
                "firstName lastName email"
            )
            .populate(
                "deletedBy",
                "firstName lastName email"
            );

        if (!product) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        return res.status(200).json({
            product,
        });

    } catch (error) {
        console.error("Get admin product error:", error);

        return res.status(500).json({
            message: "Error retrieving product",
        });
    }
}



// ADMIN: APPROVE OR REJECT PRODUCT / UPDATE
export async function reviewProduct(req, res) {
    try {
        const { id } = req.params;
        const { status, rejectionReason } = req.body;

        const adminId = getUserId(req.user);

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({
                message: "Status must be approved or rejected",
            });
        }

        if (
            status === "rejected" &&
            (
                typeof rejectionReason !== "string" ||
                !rejectionReason.trim()
            )
        ) {
            return res.status(400).json({
                message: "A rejection reason is required",
            });
        }

        const product = await Product.findById(id);

        if (!product || product.isDeleted) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        // Review proposed changes
        if (
            product.pendingChanges !== null &&
            product.pendingUpdateStatus === "pending"
        ) {
            if (product.approvalStatus !== "approved") {
                return res.status(409).json({
                    message: "Invalid product update review state",
                });
            }

            if (status === "approved") {
                const changes = product.pendingChanges;

                // Apply approved changes
                for (const [field, value] of Object.entries(changes)) {
                    if (EDITABLE_FIELDS.includes(field)) {
                        product.set(field, value);
                    }
                }

                product.pendingUpdateStatus = "approved";
                product.pendingUpdateRejectionReason = "";
                product.pendingUpdateReviewedBy = adminId;
                product.pendingUpdateReviewedAt = new Date();

                product.pendingChanges = null;

                addHistory(
                    product,
                    "product-update-approved",
                    adminId,
                    "Proposed changes approved",
                    "approved",
                    "approved"
                );

                await product.save();

                return res.status(200).json({
                    message: "Product update approved successfully",
                    product,
                });
            }

            // Reject proposed changes
            product.pendingUpdateStatus = "rejected";

            product.pendingUpdateRejectionReason =
                rejectionReason.trim();

            product.pendingUpdateReviewedBy = adminId;
            product.pendingUpdateReviewedAt = new Date();

            product.pendingChanges = null;

            addHistory(
                product,
                "product-update-rejected",
                adminId,
                rejectionReason.trim(),
                "approved",
                "approved"
            );

            await product.save();

            return res.status(200).json({
                message: "Product update rejected. Original listing remains unchanged.",
                product,
            });
        }

        // Review new product
        if (product.approvalStatus !== "pending") {
            return res.status(409).json({
                message: "Product is not awaiting initial approval",
            });
        }

        const previousStatus = product.approvalStatus;

        product.approvalStatus = status;
        product.reviewedBy = adminId;
        product.reviewedAt = new Date();

        product.rejectionReason =
            status === "rejected"
                ? rejectionReason.trim()
                : "";

        // Approved product becomes available
        if (status === "approved") {
            product.isAvailable = true;
        }

        // Rejected product is hidden
        if (status === "rejected") {
            product.isAvailable = false;
        }

        addHistory(
            product,
            `product-${status}`,
            adminId,
            rejectionReason?.trim() || "",
            previousStatus,
            status
        );

        await product.save();

        return res.status(200).json({
            message: `Product ${status} successfully`,
            product,
        });

    } catch (error) {
        console.error("Review product error:", error);

        return res.status(500).json({
            message: "Failed to review product",
        });
    }
}



// LENDER: UPDATE PRODUCT
export async function updateProduct(req, res) {
    try {
        const { id } = req.params;
        const ownerId = getUserId(req.user);

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const product = await Product.findOne({
            _id: id,
            owner: ownerId,
            isDeleted: false,
        });

        if (!product) {
            return res.status(404).json({
                message: "Product not found or not owned by you",
            });
        }

        // Cannot edit while initial approval is pending
        if (product.approvalStatus === "pending") {
            return res.status(409).json({
                message: "Your product is awaiting initial approval",
            });
        }

        // Prevent duplicate pending updates
        if (
            product.pendingUpdateStatus === "pending" &&
            product.pendingChanges !== null
        ) {
            return res.status(409).json({
                message: "Your previous product update is awaiting admin review",
            });
        }

        const { data, errors } = validateProductData(
            req.body,
            true
        );

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Product update validation failed",
                errors,
            });
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({
                message: "No valid product fields provided",
            });
        }

        // Resubmit rejected products for approval
        if (product.approvalStatus === "rejected") {
            const previousStatus = product.approvalStatus;

            for (const [field, value] of Object.entries(data)) {
                product.set(field, value);
            }

            product.approvalStatus = "pending";
            product.isAvailable = false;

            product.reviewedBy = null;
            product.reviewedAt = null;

            product.rejectionReason = "";

            product.pendingChanges = null;
            product.pendingUpdateStatus = null;
            product.pendingUpdateRejectionReason = "";
            product.pendingUpdateReviewedBy = null;
            product.pendingUpdateReviewedAt = null;

            addHistory(
                product,
                "product-resubmitted",
                ownerId,
                "Rejected product corrected and resubmitted",
                previousStatus,
                "pending"
            );

            await product.save();

            return res.status(200).json({
                message: "Product corrected and resubmitted for admin approval",
                product,
            });
        }

        // Suspended products cannot be edited by lenders
        if (product.approvalStatus === "suspended") {
            return res.status(403).json({
                message: "This product is suspended. Contact the administrator.",
            });
        }

        // Approved product updates require admin approval
        if (product.approvalStatus === "approved") {
            product.pendingChanges = data;
            product.pendingUpdateStatus = "pending";

            product.pendingUpdateRejectionReason = "";
            product.pendingUpdateReviewedBy = null;
            product.pendingUpdateReviewedAt = null;

            addHistory(
                product,
                "product-update-submitted",
                ownerId,
                "Changes submitted for admin review",
                "approved",
                "update-pending"
            );

            await product.save();

            return res.status(200).json({
                message: "Product update submitted. Waiting for admin approval.",
                product,
            });
        }

        return res.status(400).json({
            message: "This product cannot be updated",
        });

    } catch (error) {
        console.error("Update product error:", error);

        return res.status(500).json({
            message: "Error submitting product update",
        });
    }
}



// ADMIN: DIRECTLY UPDATE ANY PRODUCT
export async function adminUpdateProduct(req, res) {
    try {
        const { id } = req.params;
        const adminId = getUserId(req.user);

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const product = await Product.findById(id);

        if (!product || product.isDeleted) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        const { data, errors } = validateProductData(
            req.body,
            true
        );

        if (errors.length > 0) {
            return res.status(400).json({
                message: "Product update validation failed",
                errors,
            });
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({
                message: "No valid product fields provided",
            });
        }

        // Apply admin changes immediately
        for (const [field, value] of Object.entries(data)) {
            product.set(field, value);
        }

        // Clear pending lender changes
        product.pendingChanges = null;
        product.pendingUpdateStatus = null;
        product.pendingUpdateRejectionReason = "";
        product.pendingUpdateReviewedBy = null;
        product.pendingUpdateReviewedAt = null;

        addHistory(
            product,
            "admin-product-updated",
            adminId,
            "Product updated directly by administrator",
            product.approvalStatus,
            product.approvalStatus
        );

        await product.save();

        return res.status(200).json({
            message: "Product updated successfully by admin",
            product,
        });

    } catch (error) {
        console.error("Admin update product error:", error);

        return res.status(500).json({
            message: "Error updating product",
        });
    }
}



// ADMIN: CHANGE PRODUCT STATUS
export async function adminUpdateProductStatus(req, res) {
    try {
        const { id } = req.params;
        const { status, reason } = req.body;

        const adminId = getUserId(req.user);

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        if (!VALID_STATUSES.includes(status)) {
            return res.status(400).json({
                message: "Invalid product status",
            });
        }

        if (
            ["rejected", "suspended"].includes(status) &&
            (
                typeof reason !== "string" ||
                !reason.trim()
            )
        ) {
            return res.status(400).json({
                message: "A reason is required for this status",
            });
        }

        const product = await Product.findById(id);

        if (!product || product.isDeleted) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        const previousStatus = product.approvalStatus;

        product.approvalStatus = status;
        product.reviewedBy = adminId;
        product.reviewedAt = new Date();

        product.rejectionReason =
            status === "rejected"
                ? reason.trim()
                : "";

        // Rejected and suspended products are hidden
        if (
            ["rejected", "suspended"].includes(status)
        ) {
            product.isAvailable = false;
        }

        // Approved products become available
        if (status === "approved") {
            product.isAvailable = true;
        }

        addHistory(
            product,
            `admin-status-${status}`,
            adminId,
            reason?.trim() || "",
            previousStatus,
            status
        );

        await product.save();

        return res.status(200).json({
            message: `Product status updated to ${status}`,
            product,
        });

    } catch (error) {
        console.error("Admin update product status error:", error);

        return res.status(500).json({
            message: "Error updating product status",
        });
    }
}



// LENDER: WITHDRAW OWN PRODUCT
export async function deleteMyProduct(req, res) {
    try {
        const { id } = req.params;
        const ownerId = getUserId(req.user);

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const product = await Product.findOne({
            _id: id,
            owner: ownerId,
            isDeleted: false,
        });

        if (!product) {
            return res.status(404).json({
                message: "Product not found or not owned by you",
            });
        }

        // Soft delete
        product.isDeleted = true;
        product.deletedAt = new Date();
        product.deletedBy = ownerId;
        product.deletionReason =
            "Withdrawn by product owner";

        product.isAvailable = false;

        addHistory(
            product,
            "product-withdrawn",
            ownerId,
            "Product withdrawn by lender",
            product.approvalStatus,
            "deleted"
        );

        await product.save();

        return res.status(200).json({
            message: "Product withdrawn successfully",
        });

    } catch (error) {
        console.error("Delete lender product error:", error);

        return res.status(500).json({
            message: "Error withdrawing product",
        });
    }
}



// ADMIN: DELETE PRODUCT
export async function adminDeleteProduct(req, res) {
    try {
        const { id } = req.params;
        const adminId = getUserId(req.user);

        const { reason = "" } = req.body || {};

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const product = await Product.findById(id);

        if (!product || product.isDeleted) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        product.isDeleted = true;
        product.deletedAt = new Date();
        product.deletedBy = adminId;

        product.deletionReason =
            typeof reason === "string"
                ? reason.trim()
                : "";

        product.isAvailable = false;

        addHistory(
            product,
            "admin-product-deleted",
            adminId,
            product.deletionReason,
            product.approvalStatus,
            "deleted"
        );

        await product.save();

        return res.status(200).json({
            message: "Product removed successfully",
        });

    } catch (error) {
        console.error("Admin delete product error:", error);

        return res.status(500).json({
            message: "Error deleting product",
        });
    }
}



// ADMIN: RESTORE DELETED PRODUCT
export async function adminRestoreProduct(req, res) {
    try {
        const { id } = req.params;
        const adminId = getUserId(req.user);

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                message: "Invalid product ID",
            });
        }

        const product = await Product.findById(id);

        if (!product || !product.isDeleted) {
            return res.status(404).json({
                message: "Deleted product not found",
            });
        }

        product.isDeleted = false;
        product.deletedAt = null;
        product.deletedBy = null;
        product.deletionReason = "";

        // Only approved products can become available
        product.isAvailable =
            product.approvalStatus === "approved";

        addHistory(
            product,
            "admin-product-restored",
            adminId,
            "Product restored by administrator",
            "deleted",
            product.approvalStatus
        );

        await product.save();

        return res.status(200).json({
            message: "Product restored successfully",
            product,
        });

    } catch (error) {
        console.error("Admin restore product error:", error);

        return res.status(500).json({
            message: "Error restoring product",
        });
    }
}