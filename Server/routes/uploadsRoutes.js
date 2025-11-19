import express from "express";
import cloudinary from "../cloudinary.js";

const router = express.Router();

/**
 * Firma de subida (SIGNED UPLOAD)
 * POST /api/uploads/sign
 * Body opcional: { folder }
 */
router.post("/sign", (req, res) => {
  try {
    const folder = req.body?.folder || process.env.CLOUDINARY_FOLDER || "ecolink/acciones";
    const timestamp = Math.floor(Date.now() / 1000);

    // Solo firmamos los parámetros que enviaremos en el upload
    const paramsToSign = { timestamp, folder };

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      process.env.CLOUDINARY_API_SECRET
    );

    res.json({
      ok: true,
      timestamp,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      folder
    });
  } catch (e) {
    console.error("sign error", e);
    res.status(500).json({ ok: false });
  }
});

export default router;
