
import express from "express";

import authorizeUser from "../middleware/jwtMiddleware.js";
import { authorizeRoles } from "../middleware/authorizeRoleMiddleware.js";

import {
    addProduct,
    getMyProducts,
    getPublicProducts,
    getPendingProducts,
    reviewProduct,
    updateProduct
} from "../controllers/productController.js";

const productRouter = express.Router();

// Public: renters can view approved products
productRouter.get(
    "/public",
    getPublicProducts
);

// Lender: submit a new product
productRouter.post(
    "/add",
    authorizeUser,
    authorizeRoles("lender"),
    addProduct
);

// Lender: view their own submitted products
productRouter.get(
    "/my",
    authorizeUser,
    authorizeRoles("lender"),
    getMyProducts
);

// Admin: view products awaiting approval
productRouter.get(
    "/admin/pending",
    authorizeUser,
    authorizeRoles("admin"),
    getPendingProducts
);

// Lender: submit product updates for admin approval
productRouter.patch(
    "/:id/update",
    authorizeUser,
    authorizeRoles("lender"),
    updateProduct
);

// Admin: approve or reject a product
productRouter.patch(
    "/admin/:id/review",
    authorizeUser,
    authorizeRoles("admin"),
    reviewProduct
);

export default productRouter;
