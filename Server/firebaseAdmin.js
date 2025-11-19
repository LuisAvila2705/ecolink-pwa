// Server/firebaseAdmin.js
import admin from "firebase-admin";

if (!admin.apps.length) {
  // Leemos el JSON del service account desde una variable de entorno
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export default admin;
