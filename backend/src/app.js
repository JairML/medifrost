// Construye la aplicación Express. Recibe el repositorio por parámetro para poder
// probarla con datos en memoria sin depender de Supabase.
// Base del backend – Tarea T07 (Jair Menéndez). Las rutas de refrigeradoras y
// sensores se agregan en la rama de HU21 (MF-26).
const express = require('express');
const cors = require('cors');
const { usuarioDemo } = require('./middleware/autorizacion');

// eslint-disable-next-line no-unused-vars
function crearApp(repo, { origenPermitido = '*' } = {}) {
  const app = express();
  app.use(cors({ origin: origenPermitido }));
  app.use(express.json());
  app.use(usuarioDemo);

  app.get('/api/salud', (_req, res) => res.json({ estado: 'ok', servicio: 'medifrost-backend' }));

  app.use((_req, res) => res.status(404).json({ errores: ['Ruta no encontrada.'] }));

  // Manejo central de errores (Express 5 captura los errores de las funciones async)
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ errores: ['El cuerpo de la petición no es JSON válido.'] });
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ errores: [status >= 500 ? 'Error interno del servidor.' : err.message] });
  });

  return app;
}

module.exports = { crearApp };
