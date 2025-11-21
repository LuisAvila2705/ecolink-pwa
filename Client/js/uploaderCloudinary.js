// uploaderCloudinary.js

const MAX_FILES = 4;
const MAX_MB = 3;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

// 🔴 AJUSTA ESTOS DOS SI ALGÚN DÍA CAMBIAN EN CLOUDINARY
const CLOUD_NAME = "dxlfgnxa3";     // tu cloud_name de Cloudinary
const UPLOAD_PRESET = "EcoLink";    // nombre EXACTO del preset unsigned

export async function uploadImages(files) {
  const list = Array.from(files || []);
  if (list.length === 0) return [];
  if (list.length > MAX_FILES) throw new Error(`Máximo ${MAX_FILES} imágenes.`);

  for (const f of list) {
    if (!ALLOWED.includes(f.type)) {
      throw new Error("Formato no permitido (JPG/PNG/WEBP).");
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      throw new Error(`Cada imagen ≤ ${MAX_MB}MB.`);
    }
  }

  // ✅ YA NO PEDIMOS FIRMA AL BACKEND
  // Subimos directamente usando upload_preset unsigned
  const out = [];

  for (const file of list) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);
    // Si quieres forzar carpeta distinta a la del preset:
    // fd.append("folder", "publicaciones");

    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`;
    const r = await fetch(url, {
      method: "POST",
      body: fd,
    }).then((r) => r.json());

    if (!r?.secure_url) {
      console.error("Respuesta Cloudinary:", r);
      throw new Error("Error subiendo a Cloudinary.");
    }

    out.push({
      type: "image",
      url: r.secure_url,
      publicId: r.public_id,
      width: r.width,
      height: r.height,
      bytes: r.bytes,
      format: r.format,
    });
  }

  return out;
}

export function thumb(url, { w = 400, h = 300 } = {}) {
  return url.replace(
    "/upload/",
    `/upload/c_fill,w_${w},h_${h},f_auto,q_auto/`
  );
}
