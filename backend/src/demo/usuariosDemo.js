// Usuarios de prueba del MODO DEMO (solo en memoria; nunca se crean en Supabase). HU20 – Domenico Chang.
const { hashear } = require('../auth/contrasenas');

const CONTRASENA_DEMO = 'MediFrost2026';
const USUARIOS_DEMO = [
  { correo: 'admin@medifrost.demo', nombre: 'Administrador (demo)', rol: 'administrador' },
  { correo: 'dt@medifrost.demo', nombre: 'Directora Técnica (demo)', rol: 'directora_tecnica' },
  { correo: 'tecnico@medifrost.demo', nombre: 'Técnico de farmacia (demo)', rol: 'tecnico' },
];

async function crearUsuariosDemo(repo) {
  const hash = await hashear(CONTRASENA_DEMO);
  for (const u of USUARIOS_DEMO) {
    if (!(await repo.buscarUsuarioPorCorreo(u.correo))) await repo.crearUsuario({ ...u, hash_contrasena: hash });
  }
  return USUARIOS_DEMO.map((u) => u.correo);
}

module.exports = { crearUsuariosDemo, USUARIOS_DEMO, CONTRASENA_DEMO };
