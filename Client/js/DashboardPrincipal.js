// /js/DashboardPrincipal.js  (nombre ilustrativo, tú tienes este archivo en ./js/...)

// 1. IMPORTS QUE YA TENÍAS
import { auth, db } from "./firebase.js";
import { uploadImages } from "./uploaderCloudinary.js";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc,
  setDoc, // ⬅ nuevo para actualizar perfil
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  updateProfile, // ⬅ opcional: para que también se actualice el displayName en Auth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 2. HELPER CORTO
const $ = (s) => document.querySelector(s);

// 3. REFERENCIAS QUE YA USABAS PARA PUBLICAR
const btn = $("#btnPublicar");
const msg = $("#pubMsg");

// 4. (NUEVO) REFERENCIAS DEL MENÚ Y DEL MODAL DE PERFIL
//    Estas dependen de que hayas puesto en el HTML:
//    - el dropdown con id="userDropdown"
//    - el botón "Actualizar datos" con id="btnOpenPerfil"
//    - el modal que te di: id="perfilModal", etc.
const userDropdown = document.getElementById("userDropdown");
const btnOpenPerfil = document.getElementById("btnOpenPerfil");
const modalPerfil = document.getElementById("perfilModal");
const inpNombre = document.getElementById("perfilNombre");
const inpCorreo = document.getElementById("perfilCorreo");
const selCiudad = document.getElementById("perfilCiudad");
const inpTelefono = document.getElementById("perfilTelefono");
const btnGuardar = document.getElementById("perfilGuardar");
const btnCancelar = document.getElementById("perfilCancelar");

// 5. HACER GLOBAL EL TOGGLE (lo usas en el HTML: onclick="toggleMenu()")
window.toggleMenu = () => {
  // si no existe, no hagas nada
  if (!userDropdown) return;
  userDropdown.classList.toggle("oculto");
};

// =========================================================
// ==========   PARTE A: PUBLICAR ACCIÓN (tu código) ========
// =========================================================

// Traer perfil de Firestore para denormalizar en la publicación
async function getPerfil(uid) {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

btn?.addEventListener("click", async () => {
  try {
    if (msg) msg.textContent = "";
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Publicando…";
    }

    const user = auth.currentUser;
    if (!user) {
      if (msg) msg.textContent = "Inicia sesión.";
      return;
    }

    const descEl = $("#desc");
    const catEl = $("#categoria");
    const zonaEl = $("#zona");
    const filesEl = $("#files");

    const descripcion = descEl?.value.trim();
    const categoria = catEl?.value;
    const zona = zonaEl?.value.trim();

    if (!descripcion) {
      if (msg) msg.textContent = "Escribe una descripción.";
      return;
    }

    // 1) subir imágenes (si se eligieron)
    const files = filesEl?.files || [];
    const media = await uploadImages(files); // [] si no eligió nada

    // 2) datos del autor (denormalizados)
    const perfil = await getPerfil(user.uid);
    const autorNombre = perfil?.nombre || user.displayName || "Usuario";
    const autorFoto = perfil?.fotoPerfil || null;

    // 3) impacto simple por categoría
    const pesos = { limpieza: 5, reciclaje: 7, taller: 4, donacion: 6 };
    const impactoPuntos = pesos[categoria] ?? 3;

    // 4) crear doc en Firestore
    await addDoc(collection(db, "acciones"), {
      autorUid: user.uid,
      autorNombre,
      autorFoto,
      descripcion,
      categoria,
      media, // array devuelto por Cloudinary
      zona: zona || null,
      validado: false,
      reaccionesCount: 0,
      comentariosCount: 0,
      impactoPuntos,
      creadoEl: serverTimestamp(),
      actualizadoEl: serverTimestamp(),
    });

    if (msg) msg.textContent = "¡Acción publicada! ✅";
    if (descEl) descEl.value = "";
    if (zonaEl) zonaEl.value = "";
    if (filesEl) filesEl.value = "";
  } catch (e) {
    console.error(e);
    if (msg) msg.textContent = "No se pudo publicar.";
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Publicar";
    }
  }
});

// ---- UI: contador de caracteres ----
const desc = document.querySelector("#desc");
const charCount = document.querySelector("#charCount");
desc?.addEventListener("input", () => {
  const n = desc.value.length;
  if (charCount) charCount.textContent = `${n}/500`;
});

// ---- UI: preview de imágenes ----
const fileInput = document.querySelector("#files");
const preview = document.querySelector("#preview");
const hintFiles = document.querySelector("#hintFiles");

const MAX_FILES = 4;

fileInput?.addEventListener("change", () => {
  if (!preview) return;
  preview.innerHTML = "";
  const files = Array.from(fileInput.files || []);
  if (files.length > MAX_FILES) {
    if (hintFiles) {
      hintFiles.textContent = `Máximo ${MAX_FILES} imágenes`;
      hintFiles.style.color = "#c0392b";
    }
  } else {
    if (hintFiles) {
      hintFiles.textContent = "Hasta 4 imágenes (JPG/PNG/WEBP)";
      hintFiles.style.color = "";
    }
  }

  files.slice(0, MAX_FILES).forEach((f, idx) => {
    const url = URL.createObjectURL(f);
    const card = document.createElement("div");
    card.className = "thumb";
    card.innerHTML = `
      <img src="${url}" alt="preview ${idx + 1}" />
      <button class="rm" title="Quitar" data-i="${idx}">✕</button>
    `;
    preview.appendChild(card);
  });
});

// Quitar una imagen del preview (y del FileList)
preview?.addEventListener("click", (e) => {
  const btnRm = e.target.closest(".rm");
  if (!btnRm) return;
  const i = Number(btnRm.dataset.i);

  // reconstruimos FileList sin el índice i
  const dt = new DataTransfer();
  Array.from(fileInput.files).forEach((f, idx) => {
    if (idx !== i) dt.items.add(f);
  });
  fileInput.files = dt.files;

  // re-disparar para re-dibujar
  fileInput.dispatchEvent(new Event("change"));
});

// =========================================================
// ==========   PARTE B: MODAL "ACTUALIZAR DATOS"  ==========
// =========================================================

// 1) abrir modal y precargar datos
btnOpenPerfil?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  // cerrar el dropdown para que no quede abierto
  userDropdown?.classList.add("oculto");

  // correo viene del auth
  if (inpCorreo) inpCorreo.value = user.email || "";

  // traer perfil de Firestore
  const ref = doc(db, "usuarios", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    const data = snap.data();
    if (inpNombre) inpNombre.value = data.nombre || user.displayName || "";
    if (selCiudad) selCiudad.value = data.ciudad || "";
    if (inpTelefono) inpTelefono.value = data.telefono || "";
  } else {
    // si no hay doc, mínimo muestra displayName
    if (inpNombre) inpNombre.value = user.displayName || "";
  }

  // mostrar modal
  modalPerfil?.classList.remove("oculto");
});

// 2) cerrar modal con cancelar
btnCancelar?.addEventListener("click", () => {
  modalPerfil?.classList.add("oculto");
});

// 3) cerrar al hacer click afuera
modalPerfil?.addEventListener("click", (e) => {
  if (e.target === modalPerfil) {
    modalPerfil.classList.add("oculto");
  }
});

// 4) guardar cambios
btnGuardar?.addEventListener("click", async () => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const nombre = inpNombre?.value.trim() || "";
    const ciudad = selCiudad?.value.trim() || "";
    const tel = inpTelefono?.value.trim() || "";

    // guardar en Firestore
    const ref = doc(db, "usuarios", user.uid);
    await setDoc(
      ref,
      {
        nombre,
        ciudad,
        telefono: tel,
        actualizadoEn: serverTimestamp(),
      },
      { merge: true }
    );

    // opcional: actualizar displayName en Auth
    if (nombre && user.displayName !== nombre) {
      await updateProfile(user, { displayName: nombre });
    }

    alert("Datos actualizados ✅");
    modalPerfil?.classList.add("oculto");

    // refrescar el nombre que se ve en el dashboard, si lo tienes
    const spanNombre = document.getElementById("nombrePaciente");
    if (spanNombre) {
      spanNombre.textContent = nombre || user.email || "Usuario";
    }
  } catch (err) {
    console.error("Error guardando perfil:", err);
    alert("No se pudieron guardar los datos.");
  }
});
