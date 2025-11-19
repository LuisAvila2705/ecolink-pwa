# ---------- Base ----------
FROM node:18-alpine

# Trabajaremos dentro de /app/Server (donde vive tu server.js)
WORKDIR /app/Server

# ---------- Instalar dependencias del backend ----------
# Copiamos solo los package* para aprovechar la cache
COPY Server/package*.json ./
RUN npm ci --only=production

# ---------- Copiar código del backend ----------
COPY Server ./

# ---------- Copiar el frontend (estáticos) ----------
# Quedará en /app/Client para que el server lo sirva
WORKDIR /app
COPY Client ./Client

# Volvemos a la carpeta del server para ejecutar
WORKDIR /app/Server

# ---------- Variables por defecto dentro del contenedor ----------
# La credencial de Firebase se MONTARÁ en runtime en esta ruta:
ENV NODE_ENV=production \
    PORT=3000 \
    GOOGLE_APPLICATION_CREDENTIALS=/app/Server/serviceAccountKey.json

# Puerto expuesto por el contenedor
EXPOSE 3000

# ---------- Arranque ----------
CMD ["node", "server.js"]
