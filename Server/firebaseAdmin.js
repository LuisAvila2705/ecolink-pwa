// Server/firebaseAdmin.js
import admin from "firebase-admin";
import path from "path";
import { fileURLToPath } from "url";

if (!admin.apps.length) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // Ajusta la ruta a tu JSON real (o usa variables de entorno)
  const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
}

export default admin;
