// Server/routes/adminRoutes.js
import { Router } from "express";
import { verifyFirebaseToken } from "../middlewares/verifyFirebaseToken.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";
import { setRole, updateUser } from "../controllers/adminController.js";

const router = Router();

// POST /api/admin/setRole
router.post("/setRole", verifyFirebaseToken, requireAdmin, setRole);

// NUEVO: POST /api/admin/updateUser
router.post("/updateUser", verifyFirebaseToken, requireAdmin, updateUser);

export default router;
