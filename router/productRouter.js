import express from "express";

import authorizeUser from "../middleware/jwtMiddleware.js";
import { authorizerole } from "../middleware/authorizeRoleMiddleware.js";

import {
    addProduct,
    getMyProducts,
    getMyProductById,
    getPublicProducts,
    getPublicProductById,
    getPendingProducts,
    getAdminProducts,
    getAdminProductById,
    reviewProduct,
    updateProduct,
    adminUpdateProduct,
    adminUpdateProductStatus,
    deleteMyProduct,
    adminDeleteProduct,
    adminRestoreProduct,
} from "../controllers/productController.js";

const productRouter = express.Router();


// Public routes (no authentication required)

// View approved products
productRouter.get(
    "/public",
    getPublicProducts
);

// View one approved product
productRouter.get(
    "/public/:id",
    getPublicProductById
);


// Lender routes (authentication and role required)

// Submit a product
productRouter.post(
    "/add",
    authorizeUser,
    authorizerole("lender"),
    addProduct
);

// View own products
productRouter.get(
    "/my",
    authorizeUser,
    authorizerole("lender"),
    getMyProducts
);

// View one of own products
productRouter.get(
    "/my/:id",
    authorizeUser,
    authorizerole("lender"),
    getMyProductById
);

// Update product and submit changes for admin review
productRouter.patch(
    "/:id/update",
    authorizeUser,
    authorizerole("lender"),
    updateProduct
);

// Withdraw own product
productRouter.delete(
    "/:id",
    authorizeUser,
    authorizerole("lender"),
    deleteMyProduct
);


// Admin routes (authentication and role required)

// View products waiting for review
productRouter.get(
    "/admin/pending",
    authorizeUser,
    authorizerole("admin"),
    getPendingProducts
);

// View and search all products
productRouter.get(
    "/admin/all",
    authorizeUser,
    authorizerole("admin"),
    getAdminProducts
);

// View complete product details
productRouter.get(
    "/admin/:id",
    authorizeUser,
    authorizerole("admin"),
    getAdminProductById
);

// Approve or reject products and proposed updates
productRouter.patch(
    "/admin/:id/review",
    authorizeUser,
    authorizerole("admin"),
    reviewProduct
);

// Admin directly updates a product
productRouter.patch(
    "/admin/:id/update",
    authorizeUser,
    authorizerole("admin"),
    adminUpdateProduct
);

// Admin changes product status
productRouter.patch(
    "/admin/:id/status",
    authorizeUser,
    authorizerole("admin"),
    adminUpdateProductStatus
);

// Admin deletes a product
productRouter.delete(
    "/admin/:id",
    authorizeUser,
    authorizerole("admin"),
    adminDeleteProduct
);

// Admin restores a deleted product
productRouter.patch(
    "/admin/:id/restore",
    authorizeUser,
    authorizerole("admin"),
    adminRestoreProduct
);

export default productRouter;