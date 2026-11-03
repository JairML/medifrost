// Punto de entrada del backend. Tarea T07 – Jair Menéndez. Sprint 2: alertas (T19, T23) y login (T29).
require('dotenv').config();
const { randomBytes } = require('node:crypto');
const { crearApp } = require('./app');
const { crearRepositorioSupabase } = require('./db/repositorioSupabase');
const { crearRepositorioMemoria } = require('./db/repositorioMemoria');
const { iniciarSimulador } = require('./demo/simuladorLecturas');
const { crearNotificador } = require('./alertas/correo');
const { crearVigilante } = require('./alertas/vigilante');
const { crearUsuariosDemo, CONTRASENA_DEMO } = require('./demo/usuariosDemo');

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

// HU20: secreto para firmar las sesiones. Con Supabase es obligatorio; en demo se genera uno al azar.
let jwtSecreto = process.env.JWT_SECRET;
if (!jwtSecreto || jwtSecreto.length < 32) {
  if (!usarMemoria) {
    console.error('Falta JWT_SECRET en backend/.env (mínimo 32 caracteres). Genera uno con:');
    console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
  }
  jwtSecreto = randomBytes(32).toString('hex');
}

const app = crearApp(repo, {
  origenPermitido: process.env.FRONTEND_ORIGIN || '*',
  demo: usarMemoria ? { simulador, vigilante } : null,
  jwtSecreto,
  jwtExpira: process.env.JWT_EXPIRA || '8h',
});

if (usarMemoria) {
  crearUsuariosDemo(repo)
    .then((correos) => {
      console.log(`Usuarios de demo (contraseña «${CONTRASENA_DEMO}»): ${correos.join(', ')}`);
    })
    .catch((err) => console.error('No se pudieron crear los usuarios de demo:', err.message));
}
const puerto = Number(process.env.PORT) || 3000;

app.listen(puerto, () => {
  console.log(`MediFrost backend en http://localhost:${puerto} (${usarMemoria ? 'modo demo en memoria' : 'Supabase'})`);
});
