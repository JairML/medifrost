#!/usr/bin/env node
// Simula al nodo ESP32: envía lecturas a Supabase EXACTAMENTE como el firmware (HU02),
// con la clave PÚBLICA (publishable/anon). Sirve para probar el dashboard (HU06) y la
// prueba de punta a punta (T08) sin hardware.
//
// Uso (desde la carpeta backend):
//   npm run simular                              → una lectura de 4.5 °C de MF-NODO-01
//   npm run simular -- --temp 9.3                → una lectura fuera de rango
//   npm run simular -- --cada 60                 → una lectura cada 60 s (Ctrl+C para parar)
//   npm run simular -- --error                   → lectura «error_sensor» (temperatura null)
//   npm run simular -- --dispositivo MF-NODO-02  → otro dispositivo
//   npm run simular -- --probar-seguridad        → verifica que la clave pública NO puede leer ni borrar (HU02-3)
//
// Necesita en backend/.env: SUPABASE_URL y SUPABASE_ANON_KEY (la publishable «sb_publishable_…» o la anon).
require('dotenv').config();

const args = process.argv.slice(2);
const opcion = (nombre, porDefecto) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : porDefecto;
};
const bandera = (nombre) => args.includes(`--${nombre}`);

const URL_BASE = process.env.SUPABASE_URL;
const CLAVE = process.env.SUPABASE_ANON_KEY;
if (!URL_BASE || !CLAVE) {
  console.error('Faltan SUPABASE_URL o SUPABASE_ANON_KEY en backend/.env (usa la clave PÚBLICA, no la secreta).');
  process.exit(1);
}
if (CLAVE.startsWith('sb_secret_')) {
  console.error('Esa es la clave SECRETA. El simulador debe usar la PÚBLICA (publishable/anon), igual que el ESP32.');
  process.exit(1);
}

function encabezados(extra = {}) {
  const h = { apikey: CLAVE, 'Content-Type': 'application/json', ...extra };
  if (CLAVE.startsWith('eyJ')) h.Authorization = `Bearer ${CLAVE}`; // clave legacy anon (JWT)
  return h;
}

async function enviar() {
  const error = bandera('error');
  const cuerpo = {
    dispositivo_id: opcion('dispositivo', 'MF-NODO-01'),
    temperatura: error ? null : Math.round(Number(opcion('temp', '4.5')) * 10) / 10,
    estado: error ? 'error_sensor' : 'ok',
    medido_en: new Date().toISOString(),
  };
  const inicio = Date.now();
  const res = await fetch(`${URL_BASE}/rest/v1/lectura`, {
    method: 'POST',
    headers: encabezados({ Prefer: 'return=minimal' }),
    body: JSON.stringify(cuerpo),
  });
  const ms = Date.now() - inicio;
  if (res.status === 201) console.log(`✔ Lectura guardada en ${ms} ms:`, JSON.stringify(cuerpo));
  else console.error(`✘ Supabase respondió ${res.status}: ${await res.text()}`);
}

async function probarSeguridad() {
  console.log('Probando lo que la clave pública NO debe poder hacer (criterio HU02-3)...');
  const leer = await fetch(`${URL_BASE}/rest/v1/lectura?select=*&limit=5`, { headers: encabezados() });
  const filas = leer.ok ? await leer.json() : [];
  console.log(filas.length === 0
    ? `✔ Leer lecturas: bloqueado (HTTP ${leer.status}, 0 filas visibles)`
    : `✘ Leer lecturas: se ven ${filas.length} filas. Revisar la política RLS.`);

  const borrar = await fetch(`${URL_BASE}/rest/v1/lectura?dispositivo_id=eq.MF-NODO-01`, {
    method: 'DELETE', headers: encabezados({ Prefer: 'return=representation' }),
  });
  const borradas = borrar.ok ? await borrar.json() : [];
  console.log(borradas.length === 0
    ? `✔ Borrar lecturas: bloqueado (HTTP ${borrar.status}, 0 filas borradas)`
    : `✘ Se borraron ${borradas.length} filas. Revisar la política RLS.`);

  const refri = await fetch(`${URL_BASE}/rest/v1/refrigeradora?select=*`, { headers: encabezados() });
  const refris = refri.ok ? await refri.json() : [];
  console.log(refris.length === 0
    ? `✔ Leer refrigeradoras: bloqueado (HTTP ${refri.status}, 0 filas visibles)`
    : `✘ Se ven ${refris.length} refrigeradoras. Revisar la política RLS.`);
}

(async () => {
  if (bandera('probar-seguridad')) return probarSeguridad();
  const cada = Number(opcion('cada', '0'));
  await enviar();
  if (cada > 0) {
    console.log(`Enviando cada ${cada} s. Ctrl+C para detener.`);
    setInterval(() => enviar().catch((e) => console.error('✘', e.message)), cada * 1000);
  }
})().catch((e) => { console.error('✘ No se pudo conectar:', e.message); process.exit(1); });
