// Server/server.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/authRoutes.js';
import uploadsRoutes from './routes/uploadsRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { verifyFirebaseToken } from './middlewares/verifyFirebaseToken.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Necesario para __dirname con ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// =====================
// Middlewares generales
// =====================
app.use(cors());
app.use(express.json());

// =====================
// Servir Front (Client)
// =====================
app.use(express.static(path.join(__dirname, '../Client')));

// ================
// Rutas de la API
// ================
app.use('/api/auth', authRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/admin', adminRoutes);

// Ruta de prueba token
app.get('/api/me', verifyFirebaseToken, (req, res) => {
  res.json({
    message: 'Token válido',
    uid: req.user.uid,
    email: req.user.email
  });
});

// ============
// Ruta Home
// ============
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../Client/Inicio.html'));
});

// ============================
// Rutas explícitas para vistas
// ============================

// Panel de admin (Express NO es case-sensitive por defecto en rutas,
// así que esta ruta responde tanto a /Admin.html como /admin.html)
app.get('/Admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Client/Admin.html'));
});

// Si quieres, puedes hacer lo mismo con otras vistas sensibles:
app.get('/DashboardPrincipal.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Client/DashboardPrincipal.html'));
});

app.get('/PanelOrganizaciones.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../Client/PanelOrganizaciones.html'));
});

// ===================
// Middleware 404 HTML
// ===================
app.use((req, res) => {
  console.log('Middleware 404 -> ruta no encontrada:', req.originalUrl);
  res.status(404).sendFile(path.join(__dirname, '../Client/404.html'));
});

// ===================
// Arranque del server
// ===================
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
