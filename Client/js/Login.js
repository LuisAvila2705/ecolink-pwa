// Client/js/Login.js
// -------------------------------------------------------------
// Login con ruteo por rol:
// 1) Intenta leer el rol desde el custom claim del ID token.
// 2) Si aún no está propagado, hace fallback a Firestore (/usuarios).
// 3) Redirige según el rol:
//    - admin         -> /admin.html
//    - organizacion  -> /panelOrg.html
//    - ciudadano     -> /DashboardPrincipal.html
// -------------------------------------------------------------

import { auth, authReady, db } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, query, where, limit, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---- Refs de UI existentes
const form       = document.getElementById("login-form");
const emailInput = document.getElementById("email");
const passInput  = document.getElementById("password");
const btnLogin   = document.getElementById("btnLogin");
const msg        = document.getElementById("msg");

// Rutas de destino por rol
const ROUTES = {
  admin: "/Admin.html",
  organizacion: "/PanelOrganizaciones.html",
  ciudadano: "/DashboardPrincipal.html",
};

// ---- Utilidades de UI existentes
function setLoading(v) {
  if (!btnLogin) return;
  btnLogin.disabled = v;
  btnLogin.textContent = v ? "Autenticando..." : "Iniciar Sesión";
}
function showMessage(text, type = "info") {
  if (!msg) return;
  msg.textContent = text;
  msg.className = type; // asume clases .info/.error/.success en tu CSS
}

// ---- Helper: obtiene el rol (claim -> Firestore fallback)
async function getUserRole(user) {
  if (!user) return null;

  // 1) Intentar desde custom claim
  const tok = await user.getIdTokenResult(true); // true = forzar refresh
  let role = tok.claims?.role;

  // 2) Fallback: Firestore (solo para UI; seguridad real es en reglas/servidor)
  if (!role) {
    const snap = await getDocs(
      query(collection(db, "usuarios"), where("uid", "==", user.uid), limit(1))
    );
    role = snap.empty ? null : (snap.docs[0].data().rol || null);
  }
  return role || "ciudadano";
}

// ---- Helper: redirigir según rol
function routeByRole(role, { replace = false } = {}) {
  const href =
    role === "admin" ? ROUTES.admin :
    role === "organizacion" ? ROUTES.organizacion :
    ROUTES.ciudadano;

  if (replace) window.location.replace(href);
  else window.location.href = href;
}

// ---- Submit del login (tu flujo original + ruteo por rol)
form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = (emailInput?.value || "").trim().toLowerCase();
  const password = passInput?.value || "";

  if (!email || !password) {
    showMessage("Completa correo y contraseña.", "error");
    return;
  }

  setLoading(true);
  showMessage("Verificando credenciales...");

  try {
    // Asegura persistencia previamente configurada
    await authReady;

    // 1) Iniciar sesión
    const cred = await signInWithEmailAndPassword(auth, email, password);

    // 2) Guardar ID token (si lo usas para tu backend)
    const idToken = await cred.user.getIdToken(true);
    localStorage.setItem("idToken", idToken);

    // 3) Obtener rol y rutar
    const role = await getUserRole(cred.user);
    showMessage("Login exitoso.", "success");
    routeByRole(role); // usa location.href (deja el login en historial)
  } catch (err) {
    console.error(err);
    const code = err.code || "";
    let friendly = "No se pudo iniciar sesión.";
    if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
      friendly = "Correo o contraseña incorrectos.";
    } else if (code === "auth/user-not-found") {
      friendly = "No existe una cuenta con ese correo.";
    } else if (code === "auth/too-many-requests") {
      friendly = "Demasiados intentos. Inténtalo más tarde.";
    } else if (code === "auth/invalid-email") {
      friendly = "Correo inválido.";
    }
    showMessage(friendly, "error");
  } finally {
    setLoading(false);
  }
});

// ---- Si ya hay sesión, rutea automáticamente por rol (seguro adicional)
//     Usamos replace() para no dejar el login en el historial del navegador.
authReady.finally(() => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // sin sesión, permanecer en login
      return;
    }
    try {
      const role = await getUserRole(user);
      routeByRole(role, { replace: true });
    } catch (e) {
      console.error("No se pudo resolver el rol para ruteo automático:", e);
      // Como fallback, mandar al dashboard ciudadano
      window.location.replace(ROUTES.ciudadano);
    }
  });
});

// ---- (Opcional) Enlace "Olvidé mi contraseña"
export async function resetPassword(email) {
  try {
    const mail = (email || emailInput?.value || "").trim().toLowerCase();
    if (!mail) { showMessage("Ingresa tu correo para recuperar.", "error"); return; }
    await sendPasswordResetEmail(auth, mail);
    showMessage("Te enviamos un correo para restablecer la contraseña.", "success");
  } catch (err) {
    console.error(err);
    showMessage("No pudimos enviar el correo de recuperación.", "error");
  }
}
