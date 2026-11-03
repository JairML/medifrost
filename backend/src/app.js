// Construye la aplicación Express. Recibe el repositorio por parámetro para poder
// probarla con datos en memoria sin depender de Supabase.
const express = require('express');
const cors = require('cors');
const { autenticacion, requerirSesion } = require('./middleware/autorizacion');
const { rutasRefrigeradoras } = require('./rutas/refrigeradoras');
const { rutasSensores } = require('./rutas/sensores');
const { rutasEstado } = require('./rutas/estado');
const { rutasAlertas } = require('./rutas/alertas');
const { rutasDemo } = require('./rutas/demo');
const { rutasAuth } = require('./rutas/auth');

/**
 * @param {object} repo  repositorio (Supabase o en memoria)
 * @param {object} [opciones]
 * @param {string} [opciones.origenPermitido]  dominio del frontend (CORS)
 * @param {Function} [opciones.reloj]          hora actual (las pruebas la fijan)
 * @param {object} [opciones.demo]             { simulador, vigilante } solo en «npm run demo»
 * @param {string} [opciones.jwtSecreto]       secreto para firmar los tokens de sesión (HU20)
 * @param {string} [opciones.jwtExpira]        duración de la sesión (por defecto 8h)
 * @param {boolean} [opciones.permitirRolDemo] SOLO pruebas automáticas: rol por encabezado «x-rol» sin login.
 *                                             Por defecto se activa únicamente si no hay jwtSecreto.
 */
function crearApp(repo, {
  origenPermitido = '*', reloj = () => new Date(), demo = null,
  jwtSecreto = null, jwtExpira = undefined, permitirRolDemo = !jwtSecreto,
} = {}) {
  const app = express();
  app.use(cors({ origin: origenPermitido }));
  app.use(express.json());
  app.use(autenticacion({ secreto: jwtSecreto, permitirRolDemo, reloj }));

  // Rutas públicas
  app.get('/api/salud', (_req, res) => res.json({ estado: 'ok', servicio: 'medifrost-backend', modo: demo ? 'demo' : 'normal' }));
  app.use('/api/auth', rutasAuth(repo, { secreto: jwtSecreto, expiraEn: jwtExpira, reloj })); // HU20

  // Rutas protegidas: necesitan sesión iniciada (HU20)
  app.use('/api/refrigeradoras', requerirSesion, rutasRefrigeradoras(repo));
  app.use('/api/sensores', requerirSesion, rutasSensores(repo));
  app.use('/api/estado', requerirSesion, rutasEstado(repo));   // HU06
  app.use('/api/alertas', requerirSesion, rutasAlertas(repo, { reloj })); // HU12, HU13, HU04
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
