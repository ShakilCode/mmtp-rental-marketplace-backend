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

import {
    uploadProductImages as uploadImagesController
} from "../controllers/imageUploadController.js";

import {
    uploadProductImages as uploadMiddleware
} from "../middleware/uploadMiddleware.js";

const productRouter = express.Router();


// PUBLIC ROUTES

productRouter.get(
    "/public",
    getPublicProducts
);

productRouter.get(
    "/public/:id",
    getPublicProductById
);


// LENDER ROUTES

// Upload product images
productRouter.post(
    "/upload-images",
    authorizeUser,
    authorizerole("lender"),
    uploadMiddleware,
    uploadImagesController
);

// Create product
productRouter.post(
    "/add",
    authorizeUser,
    authorizerole("lender"),
    addProduct
);

// View lender's products
productRouter.get(
    "/my",
    authorizeUser,
    authorizerole("lender"),
    getMyProducts
);

// View one owned product
productRouter.get(
    "/my/:id",
    authorizeUser,
    authorizerole("lender"),
    getMyProductById
);

// Update product - requires admin review
productRouter.patch(
    "/:id/update",
    authorizeUser,
    authorizerole("lender"),
    updateProduct
);

// Withdraw product
productRouter.delete(
    "/:id",
    authorizeUser,
    authorizerole("lender"),
    deleteMyProduct
);


// ADMIN ROUTES

// View all pending initial products and pending updates
productRouter.get(
    "/admin/pending",
    authorizeUser,
    authorizerole("admin"),
    getPendingProducts
);

// View/search/filter all products
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

// Approve/reject new products or updates
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

// Suspend/reapprove/reject product status
productRouter.patch(
    "/admin/:id/status",
    authorizeUser,
    authorizerole("admin"),
    adminUpdateProductStatus
);

// Soft-delete product
productRouter.delete(
    "/admin/:id",
    authorizeUser,
    authorizerole("admin"),
    adminDeleteProduct
);

// Restore deleted product
productRouter.patch(
    "/admin/:id/restore",
    authorizeUser,
    authorizerole("admin"),
    adminRestoreProduct
);

export default productRouter;