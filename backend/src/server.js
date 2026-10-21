// Punto de entrada del backend. Tarea T07 – Jair Menéndez. Sprint 2: alertas (T19, T23).
require('dotenv').config();
const { crearApp } = require('./app');
const { crearRepositorioSupabase } = require('./db/repositorioSupabase');
const { crearRepositorioMemoria } = require('./db/repositorioMemoria');
const { iniciarSimulador } = require('./demo/simuladorLecturas');
const { crearNotificador } = require('./alertas/correo');
const { crearVigilante } = require('./alertas/vigilante');

// «npm run demo» pasa --demo (funciona igual en Windows, Mac y Linux)
const usarMemoria = process.argv.includes('--demo') || process.env.USE_MEMORY_DB === 'true';
const repo = usarMemoria
  ? crearRepositorioMemoria()
  : crearRepositorioSupabase({ url: process.env.SUPABASE_URL, claveServicio: process.env.SUPABASE_SERVICE_ROLE_KEY });

// En modo demo se generan lecturas simuladas para ver el dashboard en vivo (HU06)
const simulador = usarMemoria
  ? iniciarSimulador(repo, { intervaloMs: (Number(process.env.DEMO_INTERVALO_S) || 10) * 1000 })
  : null;

// HU12 / HU13 / HU04: revisión automática de alertas y envío de correos
const notificador = crearNotificador(process.env);
const vigilante = crearVigilante({
  repo,
  notificador,
  intervaloMs: (Number(process.env.ALERTAS_INTERVALO_S) || 30) * 1000,
  urlDashboard: process.env.DASHBOARD_URL || null,
});
// Con Supabase, las alertas se revisan SOLO donde ALERTAS_ACTIVAS=true (una sola computadora o el servidor
// publicado): si varios backends las revisaran a la vez, llegarían correos repetidos. En demo siempre están activas.
const alertasActivas = usarMemoria ? process.env.ALERTAS_ACTIVAS !== 'false' : process.env.ALERTAS_ACTIVAS === 'true';
if (alertasActivas) vigilante.iniciar();
else console.log('Alertas: desactivadas en esta computadora (ALERTAS_ACTIVAS=false). Las revisa otra instancia del backend.');

const app = crearApp(repo, {
  origenPermitido: process.env.FRONTEND_ORIGIN || '*',
  demo: usarMemoria ? { simulador, vigilante } : null,
});
const puerto = Number(process.env.PORT) || 3000;

app.listen(puerto, () => {
  console.log(`MediFrost backend en http://localhost:${puerto} (${usarMemoria ? 'modo demo en memoria' : 'Supabase'})`);
});
