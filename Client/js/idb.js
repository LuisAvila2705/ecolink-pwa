// /js/idb.js
// Cola offline para publicaciones (incluye imágenes).
// API:
//   queueOutbox(meta, filesArray?)  => guarda {meta,..., files:[Blob/File]}
//   flushOutbox()                   => sube a Firestore, sube imágenes con uploaderCloudinary

const DB_NAME = "ecolink_db";
const DB_VERSION = 2;                    // <- sube versión para esquema con 'files'
const STORE_OUTBOX = "outbox_posts";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // store
      let store;
      if (!db.objectStoreNames.contains(STORE_OUTBOX)) {
        store = db.createObjectStore(STORE_OUTBOX, { keyPath: "id" });
      } else {
        store = req.transaction.objectStore(STORE_OUTBOX);
      }
      // index
      if (!store.indexNames.contains("byCreatedAt")) {
        store.createIndex("byCreatedAt", "createdAt", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_OUTBOX, mode);
    const store = tx.objectStore(STORE_OUTBOX);
    const done = (v) => { tx.oncomplete = () => resolve(v); };
    tx.onerror = () => reject(tx.error);
    Promise.resolve(fn(store)).then(done, reject);
  });
}

function rid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return "loc_" + Date.now() + "_" + Math.random().toString(36).slice(2);
}

// Convierte un File/Blob en un objeto persistible (algunos navegadores serializan Blob directo;
// este formato garantiza compatibilidad)
function toPersistableFileLike(file) {
  if (!file) return null;
  return {
    name: file.name || `photo_${Date.now()}`,
    type: file.type || "application/octet-stream",
    blob: file         // IndexedDB soporta Blob; se guarda tal cual
  };
}

// Reconstruye File a partir del objeto guardado
function toFile(p) {
  if (!p) return null;
  try {
    return new File([p.blob], p.name, { type: p.type });
  } catch {
    // Si File no está disponible (ambientes antiguos), usar Blob "con nombre"
    const b = new Blob([p.blob], { type: p.type });
    b.name = p.name;
    return b;
  }
}

// ---------- API ----------
export async function queueOutbox(meta, filesArray = []) {
  const files = (filesArray || []).slice(0, 4).map(toPersistableFileLike).filter(Boolean);

  const item = {
    id: rid(),
    ...meta,                     // autorUid, autorNombre, etc.
    files,                       // imágenes offline
    createdAt: meta?.createdAt || Date.now(),
    status: "pending"
  };
  await withStore("readwrite", (store) => store.put(item));
  return item.id;
}

// Sube TODO lo pendiente a Firestore (si hay red). Devuelve cuántos subidos.
export async function flushOutbox() {
  if (!navigator.onLine) return 0;

  const { db } = await import("/js/firebase.js");
  const {
    addDoc, collection, serverTimestamp
  } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");

  // Importa tu uploader (se espera uploadImages(files:Array<File|Blob>) -> [{url,...}, ...])
  const { uploadImages } = await import("/js/uploaderCloudinary.js");

  // Leer en orden
  const items = await withStore("readonly", (store) => new Promise((resolve, reject) => {
    const out = [];
    const idx = store.index("byCreatedAt");
    const req = idx.openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) { out.push(cur.value); cur.continue(); }
      else resolve(out);
    };
    req.onerror = () => reject(req.error);
  }));

  let uploaded = 0;
  for (const it of items) {
    try {
      // Reconstruye archivos y súbelos primero
      const files = (it.files || []).map(toFile).filter(Boolean);
      let media = [];
      if (files.length > 0) {
        media = await uploadImages(files);
      }

      await addDoc(collection(db, "acciones"), {
        autorUid: it.autorUid,
        autorNombre: it.autorNombre,
        autorFoto: it.autorFoto || null,
        descripcion: it.descripcion,
        categoria: it.categoria,
        zona: it.zona || null,
        media,                                 // <-- ahora sí con URLs reales
        validado: false,
        comentariosCount: 0,
        creadoEl: serverTimestamp(),
        actualizadoEl: serverTimestamp()
      });

      // Limpia
      await withStore("readwrite", (store) => store.delete(it.id));
      uploaded++;
    } catch (err) {
      const code = String(err?.code || "");
      // Si es red, detenemos para reintentar luego
      if (!navigator.onLine || code.includes("unavailable") || code.includes("network")) break;
      // Error lógico: descartar para no bloquear
      await withStore("readwrite", (store) => store.delete(it.id));
    }
  }
  return uploaded;
}
