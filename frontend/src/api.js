// Cliente de la API de MediFrost.
// Sprint 2 (HU20): cada petición lleva el token de la sesión («Authorization: Bearer …»).
// El token se guarda en sessionStorage: dura mientras la pestaña esté abierta y vence a las 8 h.
const BASE = import.meta.env.VITE_API_URL || '';
const CLAVE_SESION = 'medifrost.sesion';

let sesion = leerSesionGuardada();
let alExpirar = () => {};

function leerSesionGuardada() {
  try {
    const s = JSON.parse(sessionStorage.getItem(CLAVE_SESION) || 'null');
    if (s && new Date(s.expira_en) > new Date()) return s;
  } catch { /* sin almacenamiento disponible: se pide login otra vez */ }
  return null;
}

function guardarSesion(s) {
  sesion = s;
  try {
    if (s) sessionStorage.setItem(CLAVE_SESION, JSON.stringify(s));
    else sessionStorage.removeItem(CLAVE_SESION);
  } catch { /* ignorar */ }
}

/** Sesión actual ({ token, usuario, expira_en }) o null. */
export const sesionActual = () => sesion;

/** La app avisa qué hacer cuando el backend responde 401 (sesión vencida). */
export function alExpirarSesion(fn) { alExpirar = fn; }

export function cerrarSesion() { guardarSesion(null); }

async function pedir(ruta, { metodo = 'GET', cuerpo, conSesion = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (conSesion && sesion) headers.Authorization = `Bearer ${sesion.token}`;
  let res;
  try {
    res = await fetch(`${BASE}/api${ruta}`, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revisa que el backend esté encendido.');
  }
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error((datos.errores || ['Ocurrió un error inesperado.']).join(' '));
    error.errores = datos.errores || [];
    error.status = res.status;
    if (res.status === 401 && conSesion) {
      guardarSesion(null);
      alExpirar(error.message);
    }
    throw error;
  }
  return datos;
}

/** HU20: inicia sesión y guarda el token. */
export async function iniciarSesion(correo, contrasena) {
  const s = await pedir('/auth/login', { metodo: 'POST', cuerpo: { correo, contrasena }, conSesion: false });
  guardarSesion(s);
  return s;
}

export const api = {
  salud: () => pedir('/salud', { conSesion: false }),
  listarRefrigeradoras: () => pedir('/refrigeradoras'),
  crearRefrigeradora: (datos) => pedir('/refrigeradoras', { metodo: 'POST', cuerpo: datos }),
  actualizarRefrigeradora: (id, datos) => pedir(`/refrigeradoras/${id}`, { metodo: 'PUT', cuerpo: datos }),
  obtenerConfiguracion: (id) => pedir(`/refrigeradoras/${id}/configuracion`),
  guardarConfiguracion: (id, datos) => pedir(`/refrigeradoras/${id}/configuracion`, { metodo: 'PUT', cuerpo: datos }),
  crearSensor: (datos) => pedir('/sensores', { metodo: 'POST', cuerpo: datos }),
  actualizarSensor: (id, datos) => pedir(`/sensores/${id}`, { metodo: 'PUT', cuerpo: datos }),
  obtenerEstado: () => pedir('/estado'), // HU06
};
