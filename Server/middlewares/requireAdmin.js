// Server/middlewares/requireAdmin.js
export function requireAdmin(req, res, next) {
  // verifyFirebaseToken ya metió el token decodificado en req.user
  if (req.user?.role !== "admin") {
    return res.status(403).json({ error: "Solo admin" });
  }
  next();
}
