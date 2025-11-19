// Server/middlewares/verifyFirebaseToken.js
import admin from "../firebaseAdmin.js";

/**
 * Middleware que:
 * 1) Lee el header Authorization: Bearer <idToken>
 * 2) Verifica el ID token de Firebase (con revocación)
 * 3) Expone en req.user y req.userToken la info del usuario autenticado
 *
 * Nota: Aquí SOLO verificamos el token. La autorización (ej. "¿es admin?")
 * la hacemos en el controlador/ruta que corresponda.
 */
export const verifyFirebaseToken = async (req, res, next) => {
  try {
    // 1) Tomar el token del header
    const header = req.headers.authorization || "";
    const match = header.match(/^Bearer (.+)$/);
    if (!match) {
      return res.status(401).json({ error: "Token faltante o formato inválido" });
    }

    const idToken = match[1];

    // 2) Verificar token (checkRevoked:true → respeta tokens revocados)
    const decoded = await admin.auth().verifyIdToken(idToken, true);
    // decoded tiene: uid, email, picture, name, claims personalizados, exp, etc.

    // 3) Intentar leer el rol desde varias posibles ubicaciones de claims
    //    (en la mayoría de los casos vendrá en decoded.role o decoded.claims?.role)
    const role =
      decoded.role ??
      decoded.claims?.role ??
      decoded.firebase?.sign_in_attributes?.role ??
      null;

    // 4) Exponer datos al siguiente handler
    req.userToken = decoded; // objeto completo decodificado
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      role, // puede ser 'admin' | 'organizacion' | 'ciudadano' | null
    };

    return next();
  } catch (err) {
    console.error("verifyFirebaseToken:", err?.code || err?.message || err);

    // 5) Responder con mensaje claro ante token revocado o inválido
    const msg =
      err?.code === "auth/id-token-revoked"
        ? "Token revocado. Vuelve a iniciar sesión."
        : "Token inválido o expirado";

    return res.status(401).json({ error: msg });
  }
};
