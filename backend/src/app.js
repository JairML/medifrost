// Construye la aplicación Express. Recibe el repositorio por parámetro para poder
// probarla con datos en memoria sin depender de Supabase.
const express = require('express');
const cors = require('cors');
const { usuarioDemo } = require('./middleware/autorizacion');
const { rutasRefrigeradoras } = require('./rutas/refrigeradoras');
const { rutasSensores } = require('./rutas/sensores');
const { rutasEstado } = require('./rutas/estado');
const { rutasAlertas } = require('./rutas/alertas');
const { rutasDemo } = require('./rutas/demo');

/**
 * @param {object} repo  repositorio (Supabase o en memoria)
 * @param {object} [opciones]
 * @param {string} [opciones.origenPermitido]  dominio del frontend (CORS)
 * @param {Function} [opciones.reloj]          hora actual (las pruebas la fijan)
 * @param {object} [opciones.demo]             { simulador, vigilante } solo en «npm run demo»
 */
function crearApp(repo, { origenPermitido = '*', reloj = () => new Date(), demo = null } = {}) {
  const app = express();
  app.use(cors({ origin: origenPermitido }));
  app.use(express.json());
  app.use(usuarioDemo);

  app.get('/api/salud', (_req, res) => res.json({ estado: 'ok', servicio: 'medifrost-backend' }));
  app.use('/api/refrigeradoras', rutasRefrigeradoras(repo));
  app.use('/api/sensores', rutasSensores(repo));
  app.use('/api/estado', rutasEstado(repo));   // HU06
  app.use('/api/alertas', rutasAlertas(repo, { reloj })); // HU12, HU13, HU04
  if (demo) app.use('/api/demo', rutasDemo({ repo, ...demo })); // solo modo demo: probar alertas sin hardware

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
