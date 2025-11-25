// /js/adminPanel.js  (versión estable)
// - Lista, filtros, paginación
// - Ver publicaciones (modal) => Firestore
// - Editar usuario (modal) => /api/admin/updateUser
// - Crear usuario (modal) => /api/admin/createUser
// - SIN Broadcast

import { auth, db } from "/js/firebase.js";
import {
  collection, query, where, orderBy, limit, startAfter, getDocs,
  doc, getDoc, updateDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const $ = (s) => document.querySelector(s);

// Top bar / filtros
const qInput   = $("#q");
const rolSel   = $("#rolSel");
const munSel   = $("#munSel");

// Tabla / paginación
const tblBody  = $("#tblUsers");
const btnPrev  = $("#btnPrev");
const btnNext  = $("#btnNext");
const statsEl  = $("#stats");

// Sub-acciones
const btnExportCsv  = $("#exportCsv");
const btnCreateUser = $("#createUser"); // SIN Broadcast

// Toast
const toastEl  = $("#toast");
function showToast(msg, ms = 2400) {
  if (!toastEl) return alert(msg);
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toastEl.classList.remove("show"), ms);
}

// Helpers
const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const debounce = (fn, d=300) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),d); }; };

function fmtDate(ts){
  try{
    if (!ts) return "—";
    if (typeof ts?.toDate === "function") return ts.toDate().toLocaleString();
    const d = new Date(ts);
    if (isNaN(+d)) return "—";
    return d.toLocaleString();
  }catch{ return "—"; }
}
function pillRol(rol){
  const map = {
    admin:       { cls:"pill-admin",   txt:"Admin" },
    organizacion:{ cls:"pill-org",     txt:"Organización" },
    ciudadano:   { cls:"pill-user",    txt:"Ciudadano" }
  };
  const p = map[rol] || map.ciudadano;
  return `<span class="pill ${p.cls}">${p.txt}</span>`;
}
function pillEstado(estado){
  return (String(estado).toLowerCase()==="activo")
   ? `<span class="pill pill-ok">activo</span>`
   : `<span class="pill pill-warn">bloqueado</span>`;
}

// Estado
const PAGE_SIZE = 25;
let lastDoc = null;
let pageStack = [];
let currentServerDocs = [];

// Guard admin
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "/login.html"; return; }

  const tok = await user.getIdTokenResult(true);
  let role = tok.claims?.role;

  if (!role) {
    const s = await getDocs(query(collection(db,"usuarios"), where("uid","==", user.uid), limit(1)));
    role = s.empty ? null : (s.docs[0].data().rol || null);
  }
  if (role !== "admin") {
    alert("Acceso restringido a administradores.");
    window.location.href = "/DashboardPrincipal.html";
    return;
  }
  await loadPage({ reset:true });
});

// Query base
function buildBaseQuery() {
  let qBase = collection(db, "usuarios");
  qBase = query(qBase, orderBy("ultimaConexion", "desc"));

  const rolVal = (rolSel?.value || "").trim();
  if (rolVal) qBase = query(qBase, where("rol", "==", rolVal));

  const munVal = (munSel?.value || "").trim();
  if (munVal) qBase = query(qBase, where("ciudad", "==", munVal));

  return qBase;
}

// Carga página
async function loadPage({ reset=false, after=null } = {}) {
  if (!tblBody) return;
  if (reset) {
    lastDoc = null; pageStack = [];
    tblBody.innerHTML = `<tr><td colspan="6" style="padding:12px">Cargando…</td></tr>`;
  }

  try {
    let qBase = buildBaseQuery();
    if (after) qBase = query(qBase, startAfter(after));
    qBase = query(qBase, limit(PAGE_SIZE));

    const snap = await getDocs(qBase);
    currentServerDocs = snap.docs;

    btnPrev && (btnPrev.disabled = pageStack.length === 0);
    btnNext && (btnNext.disabled = snap.empty);
    if (!snap.empty) lastDoc = snap.docs[snap.docs.length - 1];

    renderTable();
    renderStats();
  } catch (err) {
    console.error("Error consultando usuarios:", err);
    const msg = String(err?.message || "");
    tblBody.innerHTML = `<tr><td colspan="6" style="padding:12px;color:#b91c1c;">
      No se pudieron cargar los usuarios. ${msg.includes("index") ? "Revisa índices en Firebase." : ""}
    </td></tr>`;
  }
}

// Render tabla
function renderTable() {
  if (!tblBody) return;
  const qText = norm(qInput?.value || "");

  const docs = currentServerDocs.filter(d => {
    const u = d.data()||{};
    return !qText || norm(u.nombre).includes(qText) || norm(u.email).includes(qText);
  });

  if (!docs.length) {
    tblBody.innerHTML = `<tr><td colspan="6" style="padding:12px">Sin resultados.</td></tr>`;
    return;
  }

  const rows = docs.map(d=>{
    const u = d.data();
    const uid    = d.id;
    const nombre = u.nombre || "";
    const email  = u.email || "";
    // 🔹 Ruta corregida (minúscula) para evitar 404 en Linux/Render
    const foto   = u.fotoPerfil || "/assets/fak.png";
    const rol    = (u.rol || "ciudadano").toLowerCase();
    const mun    = u.ciudad || "";
    const estado = u.estadoCuenta || "activo";
    const ult    = fmtDate(u.ultimaConexion);

    return `
      <tr>
        <td>
          <div class="cell-user" title="${email}">
            <img src="${foto}" alt="Avatar de ${nombre}">
            <div>
              <div class="name">${nombre}</div>
              <div class="email">${email}</div>
            </div>
          </div>
        </td>
        <td class="col-mun">${mun || "—"}</td>
        <td>${pillRol(rol)}</td>
        <td class="col-estado">${pillEstado(estado)}</td>
        <td class="col-ult">${ult}</td>
        <td>
          <div class="actions">
            <button type="button" class="btn-chip"                 data-view-posts="${uid}">Ver publicaciones</button>
            <button type="button" class="btn-chip"                 data-edit-user="${uid}">Editar</button>
            <button type="button" class="btn-chip btn-danger"      data-toggle="${uid}" data-current="${estado}">
              ${estado==="activo" ? "Bloquear" : "Activar"}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");

  tblBody.innerHTML = rows;
}

// Stats
function renderStats(){
  if (!statsEl) return;
  const all = currentServerDocs.map(d=>d.data()||{});
  const tot = all.length;
  const cC  = all.filter(u => (u.rol||"ciudadano")==="ciudadano").length;
  const cO  = all.filter(u => (u.rol||"ciudadano")==="organizacion").length;
  const cA  = all.filter(u => (u.rol||"ciudadano")==="admin").length;
  statsEl.textContent = `${tot} totales · ${cC} ciudadanos · ${cO} orgs · ${cA} admins`;
}

// Filtros
const doSearch = debounce(() => loadPage({ reset:true }), 300);
qInput?.addEventListener("input", doSearch);
rolSel?.addEventListener("change", () => loadPage({ reset:true }));
munSel?.addEventListener("change", () => loadPage({ reset:true }));

// Paginación
btnNext?.addEventListener("click", async () => {
  if (!lastDoc) return;
  pageStack.push(lastDoc);
  await loadPage({ after:lastDoc });
});
btnPrev?.addEventListener("click", async () => {
  if (!pageStack.length) return;
  const anchor = pageStack.pop();

  let cursor = null, qBase = buildBaseQuery(), foundPage = null;
  while (true) {
    let qPage = cursor ? query(qBase, startAfter(cursor), limit(PAGE_SIZE)) : query(qBase, limit(PAGE_SIZE));
    const snap = await getDocs(qPage);
    if (snap.empty) break;
    const hit = snap.docs.find(d=>d.id===anchor.id);
    if (hit) { foundPage = snap.docs; lastDoc = snap.docs[snap.docs.length-1]; break; }
    cursor = snap.docs[snap.docs.length-1];
  }
  if (foundPage) { currentServerDocs = foundPage; renderTable(); renderStats(); }
  btnPrev.disabled = pageStack.length===0;
  btnNext.disabled = !lastDoc;
});

// ===================== Modal genérico (1 solo) ======================
function ensureModalRoot() {
  let root = document.getElementById("adminModals");
  if (!root) {
    root = document.createElement("div");
    root.id = "adminModals";
    document.body.appendChild(root);
  }
  return root;
}
function closeAnyModal() {
  const r = document.getElementById("adminModals");
  if (r) r.innerHTML = "";
}
function openModal({ title, bodyHTML, onOpen }) {
  closeAnyModal();
  const root = ensureModalRoot();
  const wrap = document.createElement("div");
  wrap.className = "modal";
  wrap.innerHTML = `
    <div class="modal-card" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>${title || ""}</h3>
        <button type="button" class="modal-close" data-close>✕</button>
      </div>
      <section class="modal-body">${bodyHTML || ""}</section>
    </div>`;
  root.appendChild(wrap);
  wrap.addEventListener("click", (e)=>{ if (e.target === wrap || e.target.closest("[data-close]")) closeAnyModal(); });
  if (typeof onOpen === "function") onOpen(wrap);
  return wrap;
}

// ==================== Acciones Tabla =====================
document.addEventListener("click", async (e)=>{
  const btnView   = e.target.closest("button[data-view-posts]");
  const btnEdit   = e.target.closest("button[data-edit-user]");
  const btnToggle = e.target.closest("button[data-toggle]");

  // Ver publicaciones (directo Firestore)
  if (btnView){
    const uid = btnView.getAttribute("data-view-posts");

    const qAcc = query(
      collection(db, "acciones"),
      where("autorUid","==", uid),
      orderBy("creadoEl","desc"),
      limit(50)
    );
    let items = [];
    try {
      const snap = await getDocs(qAcc);
      items = snap.docs.map(d=>({ id:d.id, ...d.data() }));
    } catch(err) {
      console.error(err);
      return alert("No se pudieron cargar las publicaciones.");
    }

    const bodyHTML = `
      <div style="display:grid;gap:12px;max-height:60vh;overflow:auto">
        ${items.length ? items.map(p=>`
          <article class="post-mini" style="border:1px solid #e6efea;border-radius:12px;padding:10px">
            <div style="font-weight:700">${(p.descripcion||'').slice(0,140) || '(Sin descripción)'}</div>
            <div class="muted" style="font-size:.85rem;margin:.25rem 0 .5rem 0">
              ${p.categoria || ''}${p.zona ? ' · '+p.zona : ''} · ${p.creadoEl?.toDate ? fmtDate(p.creadoEl) : ''}
            </div>
            ${p.media?.[0]?.url ? `
              <a href="${p.media[0].url}" target="_blank" rel="noopener">
                <img src="${p.media[0].url}" alt="" loading="lazy" style="max-width:100%;border-radius:8px;display:block">
              </a>` : ``}
            <div class="muted" style="font-size:.75rem">ID: ${p.id}</div>
          </article>
        `).join("") : `<div class="empty">Sin publicaciones de este usuario.</div>`}
      </div>
    `;
    openModal({ title:"Publicaciones", bodyHTML });
    return;
  }

  // Editar usuario (vía server)
  if (btnEdit){
    const uid = btnEdit.getAttribute("data-edit-user");
    const ref = doc(db,"usuarios",uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return alert("Usuario no encontrado.");
    const u = snap.data();

    const bodyHTML = `
      <form class="form-grid" data-form="uEdit">
        <label>Nombre
          <input type="text" name="nombre" required value="${(u.nombre||'').replace(/"/g,'&quot;')}">
        </label>
        <label>Municipio / Ciudad
          <input type="text" name="ciudad" value="${(u.ciudad||'').replace(/"/g,'&quot;')}">
        </label>
        <label>Teléfono
          <input type="tel" name="telefono" value="${(u.telefono||'').replace(/"/g,'&quot;')}">
        </label>
        <div class="modal-actions">
          <button type="button" class="btn-light" data-close>Cancelar</button>
          <button type="submit" class="btn-primary">Guardar</button>
        </div>
      </form>
    `;
    openModal({
      title:"Editar usuario",
      bodyHTML,
      onOpen(mod){
        const form = mod.querySelector('form[data-form="uEdit"]');
        form.onsubmit = async (ev)=>{
          ev.preventDefault();
          const fd = new FormData(form);
          const payload = {
            uid,
            nombre:  (fd.get("nombre")  || "").toString().trim(),
            ciudad:  (fd.get("ciudad")  || "").toString().trim() || null,
            telefono:(fd.get("telefono")|| "").toString().trim() || null,
          };
          if (!payload.nombre) return;

          try{
            const user = auth.currentUser;
            if (!user) {
              throw new Error("Tu sesión ha expirado, vuelve a iniciar sesión.");
            }

            // 🔹 Forzamos refresco del token para evitar "token inválido o expirado"
            const idToken = await user.getIdToken(true);

            const resp = await fetch("/api/admin/updateUser", {
              method:"POST",
              headers:{
                "Content-Type":"application/json",
                "Authorization":`Bearer ${idToken}`
              },
              body: JSON.stringify(payload)
            });

            if (resp.status === 401) {
              const data = await resp.json().catch(()=>({}));
              const msg = data.error || "Token inválido o expirado. Vuelve a iniciar sesión.";
              throw new Error(msg);
            }

            if (!resp.ok) {
              const data = await resp.json().catch(()=>({}));
              throw new Error(data.error || "Fallo actualización");
            }

            showToast("Usuario actualizado.");
            closeAnyModal();
            await loadPage({ reset:true });
          }catch(e){
            console.error(e);
            alert(e.message || "No se pudo guardar.");
          }
        };
      }
    });
    return;
  }

  // Bloquear / activar
  if (btnToggle){
    const uid = btnToggle.getAttribute("data-toggle");
    const current = btnToggle.getAttribute("data-current") || "activo";
    const next = current === "activo" ? "bloqueado" : "activo";

    btnToggle.disabled = true;
    try {
      await updateDoc(doc(db, "usuarios", uid), { estadoCuenta: next, actualizadoEl: serverTimestamp() });
      btnToggle.textContent = next === "activo" ? "Bloquear" : "Activar";
      btnToggle.setAttribute("data-current", next);

      const tdEstado = btnToggle.closest("tr")?.querySelector(".col-estado");
      if (tdEstado) tdEstado.innerHTML = pillEstado(next);
      showToast(next === "activo" ? "Usuario activado." : "Usuario bloqueado.");
    } catch (err) {
      console.error(err);
      alert("No se pudo cambiar el estado.");
    } finally {
      btnToggle.disabled = false;
    }
  }
});

// ================ Sub-acción: Exportar CSV =================
btnExportCsv?.addEventListener("click", ()=>{
  const rows = currentServerDocs.map(d=>{
    const u = d.data()||{};
    return {
      uid: d.id,
      nombre: u.nombre || "",
      email: u.email || "",
      rol: u.rol || "ciudadano",
      municipio: u.ciudad || "",
      estado: u.estadoCuenta || "activo",
      ultimaConexion: fmtDate(u.ultimaConexion)
    };
  });
  const header = Object.keys(rows[0] || {uid:"",nombre:"",email:"",rol:"",municipio:"",estado:"",ultimaConexion:""});
  const csv = [
    header.join(","), ...rows.map(r => header.map(h => `"${String(r[h]??"").replace(/"/g,'""')}"`).join(","))
  ].join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `usuarios_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  showToast("CSV generado.");
});

/* =========================== CREAR USUARIO ============================ */
document.getElementById("createUser")?.addEventListener("click", () => {
  const html = `
    <form id="cuForm" class="form-grid" autocomplete="off" novalidate>
      <label>Nombre
        <input id="cuNombre" type="text" required placeholder="Nombre y apellidos">
      </label>
      <label>Correo
        <input id="cuEmail" type="email" required placeholder="correo@dominio.com" autocomplete="email">
      </label>
      <label>Contraseña
        <input id="cuPass" type="password" required minlength="6" placeholder="Mínimo 6 caracteres">
      </label>
      <label>Rol
        <select id="cuRol">
          <option value="ciudadano">ciudadano</option>
          <option value="organizacion">organizacion</option>
          <option value="admin">admin</option>
        </select>
      </label>
      <label>Municipio (opcional)
        <input id="cuCiudad" type="text" placeholder="Santa Catarina">
      </label>

      <div id="cuErr" class="perfil-msg oculto"></div>

      <div class="modal-actions">
        <button type="button" class="btn-light" id="cuCancel">Cancelar</button>
        <button type="submit" class="btn-primary">Crear</button>
      </div>
    </form>
  `;
  const modal = openSimpleModal({
    title: "Crear usuario",
    bodyHTML: html,
    onReady: (m) => {
      const $ = (sel)=> m.querySelector(sel);
      $("#cuCancel").onclick = () => closeAnyModal(modal);
      $("#cuForm").onsubmit = async (ev) => {
        ev.preventDefault();
        const nombre = $("#cuNombre").value.trim();
        const email  = $("#cuEmail").value.trim().toLowerCase();
        const pass   = $("#cuPass").value;
        const rol    = $("#cuRol").value;
        const ciudad = $("#cuCiudad").value.trim() || null;
        const errBox = $("#cuErr");

        if (!nombre || !email || pass.length < 6) {
          errBox.textContent = "Completa nombre/correo y una contraseña de mínimo 6 caracteres.";
          errBox.classList.remove("oculto");
          return;
        }
        try {
          const idToken = await getIdToken();
          const resp = await fetch("/api/admin/createUser", {
            method: "POST",
            headers: { "Content-Type":"application/json", "Authorization": `Bearer ${idToken}` },
            body: JSON.stringify({ nombre, email, password: pass, rol, ciudad })
          });
          if (!resp.ok) {
            const { error } = await resp.json().catch(()=>({error:"Error"}));
            throw new Error(error || `HTTP ${resp.status}`);
          }
          showToast("Usuario creado.");
          closeAnyModal(modal);
          await loadPage({ reset:true });
        } catch (e) {
          errBox.textContent = "No se pudo crear: " + (e.message || e);
          errBox.classList.remove("oculto");
        }
      };
    }
  });
});

// ========= estilos mínimos inyectados (si tu CSS ya los tiene, ignora) ======
(function injectOnce(){
  if (document.getElementById("admin-inline-styles")) return;
  const css = `
  .cell-user{display:flex;gap:10px;align-items:center}
  .cell-user img{width:34px;height:34px;border-radius:50%;object-fit:cover;border:1px solid #e6efea}
  .cell-user .name{font-weight:600}
  .cell-user .email{font-size:.82rem;color:#578474}
  .pill{display:inline-flex;align-items:center;gap:6px;padding:.2rem .5rem;border-radius:999px;font-size:.78rem;font-weight:700;white-space:nowrap}
  .pill-ok{background:#e9fbf2;color:#0b5138;border:1px solid #c2efd8}
  .pill-warn{background:#fff1f0;color:#7a1f1f;border:1px solid #f5c8c4}
  .pill-user{background:#eef7ff;color:#113a6b;border:1px solid #cfe3ff}
  .pill-org{background:#fff6e9;color:#6b400f;border:1px solid #fadcaa}
  .pill-admin{background:#f1e9ff;color:#3d196b;border:1px solid #d8c6ff}
  .actions{display:flex;gap:8px;justify-content:flex-end;white-space:nowrap}
  .btn-chip{border:1px solid #dfeae5;background:#fff;padding:.35rem .55rem;border-radius:999px;font-size:.8rem;font-weight:600;color:#114c3c}
  .btn-chip:hover{background:#f3fbf7;border-color:#cfe5db}
  .btn-danger{color:#7a1f1f;border-color:#f0d1ce}
  .btn-danger:hover{background:#fff1f0;border-color:#e9b7b2}
  `;
  const style = document.createElement("style");
  style.id = "admin-inline-styles";
  style.textContent = css;
  document.head.appendChild(style);
})();
