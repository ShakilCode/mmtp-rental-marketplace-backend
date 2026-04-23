import Product from "../models/Product.js";

// Create Product (Lender only)
export async function addProduct(req, res) {
    try {


        // 1. GET USER FROM TOKEN
        const user = req.user;

        // safety check
        if (!user) {
            return res.status(401).json({
                message: "Unauthorized - No user found"
            });
        }


        // 2. VALIDATE REQUIRED FIELDS
        const {
            productId,
            title,
            description,
            category,
            pricePerDay,
            location
        } = req.body;

        const missingFields = [];

        if (!productId) missingFields.push("productId");
        if (!title) missingFields.push("title");
        if (!description) missingFields.push("description");
        if (!category) missingFields.push("category");
        if (!pricePerDay) missingFields.push("pricePerDay");
        if (!location?.city) missingFields.push("location.city");

        if (missingFields.length > 0) {
            return res.status(400).json({
                message: "Missing required fields",
                missing: missingFields  // 👈 tells user all missing fields at once
            });
        }


        // 3. CHECK DUPLICATE PRODUCT
        const existingProduct = await Product.findOne({ productId });

        if (existingProduct) {
            return res.status(400).json({
                message: "Product with this productId already exists"
            });
        }


        // 4. BUILD PRODUCT OBJECT
        const productData = {
            productId,
            title,
            description,
            category,
            pricePerDay,
            pricePerHour: req.body.pricePerHour || null,
            oldPrice: req.body.oldPrice || null,
            deposit: req.body.deposit || 0,

            // optional fields
            altNames: req.body.altNames || [],
            images: req.body.images || ["/images/default-product.png"],
            isAvailable: req.body.isAvailable ?? true,
            condition: req.body.condition || "good",

            // availability
            availability: {
                startDate: req.body.availability?.startDate || null,
                endDate: req.body.availability?.endDate || null,
            },

            // IMPORTANT: assign owner from logged-in user
            owner: user.id,

            // location
            location: {
                city: location.city,
                district: location.district || "",
                country: location.country || "Sri Lanka",
            }
        };

        // 5. CREATE PRODUCT
        const newProduct = await Product.create(productData);

        // 6. RESPONSE
        return res.status(201).json({
            message: "Product created successfully",
            product: newProduct
        });

    } catch (error) {
        return res.status(500).json({
            message: "Error creating product",
            error: error.message
        });
    }
}