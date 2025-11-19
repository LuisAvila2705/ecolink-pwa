// Server/controllers/adminController.js
import admin from "../firebaseAdmin.js";

export const setRole = async (req, res) => {
  try {
    const caller = req.user;
    if (!caller) return res.status(401).json({ error: "No autenticado" });

    let callerIsAdmin = caller.role === "admin";
    if (!callerIsAdmin) {
      const doc = await admin.firestore().doc(`usuarios/${caller.uid}`).get();
      callerIsAdmin = (doc.exists && doc.data()?.rol === "admin");
    }
    if (!callerIsAdmin) {
      return res.status(403).json({ error: "Solo admin puede modificar roles" });
    }

    const { uid, role } = req.body || {};
    const allowed = new Set(["ciudadano", "organizacion", "admin"]);
    if (!uid || !allowed.has(role)) {
      return res.status(400).json({ error: "Parámetros inválidos" });
    }
    if (uid === caller.uid && role !== "admin") {
      return res.status(400).json({ error: "No puedes degradarte a ti mismo" });
    }

    await admin.auth().setCustomUserClaims(uid, { role });
    await admin.firestore().doc(`usuarios/${uid}`).set({ rol: role }, { merge: true });
    await admin.auth().revokeRefreshTokens(uid);
    await admin.firestore().collection("auditoria").add({
      type: "setRole",
      targetUid: uid,
      newRole: role,
      adminUid: caller.uid,
      ts: admin.firestore.FieldValue.serverTimestamp(),
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("setRole:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
};

// NUEVO: actualizar nombre/ciudad/teléfono desde el panel admin
export const updateUser = async (req, res) => {
  try {
    const caller = req.user;
    if (!caller) return res.status(401).json({ error: "No autenticado" });

    // Aceptamos admin por claim o por documento /usuarios
    let callerIsAdmin = caller.role === "admin";
    if (!callerIsAdmin) {
      const doc = await admin.firestore().doc(`usuarios/${caller.uid}`).get();
      callerIsAdmin = (doc.exists && doc.data()?.rol === "admin");
    }
    if (!callerIsAdmin) {
      return res.status(403).json({ error: "Solo admin" });
    }

    const { uid, nombre, ciudad = null, telefono = null } = req.body || {};
    if (!uid || typeof nombre !== "string") {
      return res.status(400).json({ error: "Parámetros inválidos" });
    }

    // 1) Firestore
    await admin.firestore().doc(`usuarios/${uid}`).set(
      {
        nombre,
        ciudad: ciudad || null,
        telefono: telefono || null,
        actualizadoEl: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // 2) Opcional: reflejar displayName en Auth (NO lanza si el usuario no existe)
    try {
      await admin.auth().updateUser(uid, { displayName: nombre });
    } catch (e) {
      // Si falla (por ejemplo, usuario borrado), no rompas el flujo del panel
      console.warn("updateUser (auth.displayName) warning:", e?.message);
    }

    // 3) Auditoría
    await admin.firestore().collection("auditoria").add({
      type: "updateUser",
      targetUid: uid,
      adminUid: caller.uid,
      ts: admin.firestore.FieldValue.serverTimestamp(),
      fields: { nombre: !!nombre, ciudad: ciudad !== undefined, telefono: telefono !== undefined },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("updateUser:", err);
    return res.status(500).json({ error: err.message || "Error interno" });
  }
};
