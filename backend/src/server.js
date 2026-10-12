// Punto de entrada del backend. Tarea T07 – Jair Menéndez.
require('dotenv').config();
const { crearApp } = require('./app');
const { crearRepositorioSupabase } = require('./db/repositorioSupabase');
const { crearRepositorioMemoria } = require('./db/repositorioMemoria');
const { iniciarSimulador } = require('./demo/simuladorLecturas');

// «npm run demo» pasa --demo (funciona igual en Windows, Mac y Linux)
const usarMemoria = process.argv.includes('--demo') || process.env.USE_MEMORY_DB === 'true';
const repo = usarMemoria
  ? crearRepositorioMemoria()
  : crearRepositorioSupabase({ url: process.env.SUPABASE_URL, claveServicio: process.env.SUPABASE_SERVICE_ROLE_KEY });

// En modo demo se generan lecturas simuladas para ver el dashboard en vivo (HU06)
if (usarMemoria) iniciarSimulador(repo, { intervaloMs: (Number(process.env.DEMO_INTERVALO_S) || 10) * 1000 });

const app = crearApp(repo, { origenPermitido: process.env.FRONTEND_ORIGIN || '*' });
const puerto = Number(process.env.PORT) || 3000;

app.listen(puerto, () => {
  console.log(`MediFrost backend en http://localhost:${puerto} (${usarMemoria ? 'modo demo en memoria' : 'Supabase'})`);
});
