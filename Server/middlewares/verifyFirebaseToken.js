// Server/middlewares/verifyFirebaseToken.js
import admin from "../firebaseAdmin.js";

export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";

    // 1) Debe venir como "Bearer <token>"
    if (!header.startsWith("Bearer ")) {
      console.error("verifyFirebaseToken: header sin Bearer ->", header);
      return res.status(401).json({ error: "Token faltante o formato inválido" });
    }

    const idToken = header.split(" ")[1];
    if (!idToken) {
      console.error("verifyFirebaseToken: token vacío");
      return res.status(401).json({ error: "Token faltante o formato inválido" });
    }

    // 2) Verificar token (sin checkRevoked para descartar ese factor)
    const decoded = await admin.auth().verifyIdToken(idToken);

    // Si tu custom claim se llama "role", estará en decoded.role
    const role = decoded.role ?? null;

    req.userToken = decoded;
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      role,
    };

    console.log("verifyFirebaseToken OK uid:", decoded.uid, "role:", role);
    return next();
  } catch (err) {
    console.error(
      "verifyFirebaseToken error:",
      err?.code || "",
      err?.message || err
    );
    return res.status(401).json({ error: "Token inválido o expirado" });
  }
};
