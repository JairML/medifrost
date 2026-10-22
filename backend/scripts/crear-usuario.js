#!/usr/bin/env node
// Crea un usuario en Supabase (HU20). Tarea T29 – Domenico Chang.
// Uso (desde la carpeta backend):
//   npm run crear-usuario -- --correo dt@boticasperu.pe --nombre "Q.F. Ana Pérez" --rol directora_tecnica
// Pide la contraseña por teclado (mínimo 8 caracteres). Roles: administrador | directora_tecnica | tecnico
// Necesita en backend/.env: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
require('dotenv').config();
const readline = require('node:readline/promises');
const { crearRepositorioSupabase } = require('../src/db/repositorioSupabase');
const { hashear, validarContrasena } = require('../src/auth/contrasenas');
const { ROLES } = require('../src/middleware/autorizacion');

const args = process.argv.slice(2);
const opcion = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };

(async () => {
  const correo = String(opcion('correo') || '').trim().toLowerCase();
  const nombre = String(opcion('nombre') || '').trim();
  const rol = String(opcion('rol') || '').trim();
  if (!correo.includes('@') || !nombre || !ROLES.includes(rol)) {
    console.error('Uso: npm run crear-usuario -- --correo CORREO --nombre "NOMBRE" --rol administrador|directora_tecnica|tecnico');
    process.exit(1);
  }
  let contrasena = opcion('contrasena');
  if (!contrasena) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    contrasena = await rl.question('Contraseña (mínimo 8 caracteres): ');
    rl.close();
  }
  const v = validarContrasena(contrasena);
  if (!v.valido) { console.error(`✘ ${v.errores.join(' ')}`); process.exit(1); }

  const repo = crearRepositorioSupabase({ url: process.env.SUPABASE_URL, claveServicio: process.env.SUPABASE_SERVICE_ROLE_KEY });
  try {
    const u = await repo.crearUsuario({ correo, nombre, rol, hash_contrasena: await hashear(contrasena) });
    console.log(`✔ Usuario creado: ${u.nombre} <${u.correo}> (${u.rol}). La contraseña se guardó solo como hash bcrypt.`);
  } catch (e) {
    console.error(`✘ ${e.message}`);
    process.exit(1);
  }
})();
