// /js/roleNav.js
import { auth, db } from "/js/firebase.js";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

/**
 * Util simple para mostrar/ocultar un elemento por selector
 * @param {string} sel - selector CSS
 * @param {boolean} visible - true = visible, false = display:none
 */
function show(sel, visible) {
  const el = document.querySelector(sel);
  if (!el) return;
  el.style.display = visible ? "" : "none";
}

/**
 * Obtiene el rol del usuario:
 * 1) Intenta leerlo de los custom claims (tok.claims.role)
 * 2) Si no existe, cae a Firestore: colección "usuarios" filtrando por uid
 */
async function fetchRole(user) {
  if (!user) return null;

  // 1) Custom claims
  try {
    const tok = await user.getIdTokenResult(true);
    if (tok?.claims?.role) return tok.claims.role;
  } catch {
    // ignoramos error y seguimos a Firestore
  }

  // 2) Firestore
  try {
    const snap = await getDocs(
      query(
        collection(db, "usuarios"),
        where("uid", "==", user.uid),
        limit(1)
      )
    );

    if (!snap.empty) {
      return snap.docs[0].data().rol || null;
    }
  } catch {
    // ignoramos error, devolverá null
  }

  return null;
}

/**
 * Define qué botones se muestran según el rol
 * y según la página actual (location.pathname).
 */
function toggleButtonsFor(role) {
  const isAdmin = role === "admin";
  const isOrg = role === "organizacion";

  // Visibilidad general (si existen esos botones en la página actual)
  show("#btnGoCitizen", isAdmin || isOrg); // “Ir a Ciudadanos”
  show("#btnGoOrg", isAdmin || isOrg);     // “Ir a Organizaciones”
  show("#btnGoAdmin", isAdmin);            // “Panel de Admin”

  // Normalizamos el path a minúsculas
  const path = location.pathname.toLowerCase();

  // Dashboard de ciudadano
  if (path.includes("dashboardprincipal.html")) {
    show("#btnGoOrg", isAdmin || isOrg);
    show("#btnGoAdmin", isAdmin);
  }

  // Panel de organizaciones
  if (path.includes("panelorganizaciones.html") || path.includes("panelorg")) {
    show("#btnGoCitizen", isAdmin || isOrg);
    show("#btnGoAdmin", isAdmin);
  }

  // Panel de admin
  // OJO: como usamos toLowerCase(), aquí también debe ir en minúsculas
  if (path.includes("admin.html")) {
    show("#btnGoCitizen", true);
    show("#btnGoOrg", true);
    // En admin no tiene sentido mostrar #btnGoAdmin
    show("#btnGoAdmin", false);
  }
}

// Escucha cambios de autenticación y ajusta los botones según el rol
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Sin sesión: oculta todos los botones posibles
    toggleButtonsFor(null);
    return;
  }

  const role = await fetchRole(user);
  toggleButtonsFor(role);
});
