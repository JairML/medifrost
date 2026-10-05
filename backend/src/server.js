// Punto de entrada del backend. Tarea T07 – Jair Menéndez.
require('dotenv').config();
const { crearApp } = require('./app');
const { crearRepositorioSupabase } = require('./db/repositorioSupabase');
const { crearRepositorioMemoria } = require('./db/repositorioMemoria');

const usarMemoria = process.env.USE_MEMORY_DB === 'true';
const repo = usarMemoria
  ? crearRepositorioMemoria()
  : crearRepositorioSupabase({ url: process.env.SUPABASE_URL, claveServicio: process.env.SUPABASE_SERVICE_ROLE_KEY });

const app = crearApp(repo, { origenPermitido: process.env.FRONTEND_ORIGIN || '*' });
const puerto = Number(process.env.PORT) || 3000;

app.listen(puerto, () => {
  console.log(`MediFrost backend en http://localhost:${puerto} (${usarMemoria ? 'modo demo en memoria' : 'Supabase'})`);
});
