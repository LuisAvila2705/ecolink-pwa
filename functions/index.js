// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.setCustomRole = functions
  .region("us-central1") // misma región que usarás en el cliente
  .https.onCall(async (data, context) => {
    // 1) Autenticado
    const caller = context.auth;
    if (!caller) {
      throw new functions.https.HttpsError("unauthenticated", "Inicia sesión.");
    }

    // 2) Debe ser admin
    const callerRole = caller.token?.role;
    if (callerRole !== "admin") {
      throw new functions.https.HttpsError("permission-denied", "Solo admin.");
    }

    // 3) Validar parámetros
    const { uid, role } = data || {};
    const allowed = new Set(["ciudadano", "organizacion", "admin"]);
    if (!uid || !allowed.has(role)) {
      throw new functions.https.HttpsError("invalid-argument", "Parámetros inválidos.");
    }

    // Evitar degradarte a ti mismo
    if (uid === caller.uid && role !== "admin") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "No puedes degradarte a ti mismo."
      );
    }

    // 4) Asignar custom claim
    await admin.auth().setCustomUserClaims(uid, { role });

    // 5) Actualizar Firestore (para tu UI)
    await admin.firestore().doc(`usuarios/${uid}`).set({ rol: role }, { merge: true });

    // 6) Revocar tokens anteriores del target (para que vea su nuevo rol al reloguear)
    await admin.auth().revokeRefreshTokens(uid);

    // 7) Auditoría (opcional)
    await admin.firestore().collection("auditoria").add({
      type: "setCustomRole",
      targetUid: uid,
      newRole: role,
      adminUid: caller.uid,
      ts: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true };
  });
