import express from "express";
import authorizeUser from "../middleware/jwtMiddleware.js";
import { authorizeRoles } from "../middleware/authorizeRoleMiddleware.js";
import { addProduct } from "../controllers/productController.js";

const productRouter = express.Router();

// Add Product (ONLY lender)
productRouter.post(
    "/add",
    authorizeUser,
    authorizeRoles("lender"),
    addProduct
);

export default productRouter;