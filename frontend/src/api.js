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

// Seguridad (SonarQube): solo se piden rutas internas de la API con caracteres permitidos
// y los identificadores se codifican, para que un dato no pueda cambiar el destino de la petición.
const RUTA_VALIDA = /^\/[A-Za-z0-9/_\-]+(\?[A-Za-z0-9=&_\-]*)?$/;
const seg = (valor) => encodeURIComponent(String(valor));

async function pedir(ruta, { metodo = 'GET', cuerpo, conSesion = true } = {}) {
  if (!RUTA_VALIDA.test(ruta) || ruta.includes('..')) throw new Error('Ruta de la API no válida.');
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
  actualizarRefrigeradora: (id, datos) => pedir(`/refrigeradoras/${seg(id)}`, { metodo: 'PUT', cuerpo: datos }),
  obtenerConfiguracion: (id) => pedir(`/refrigeradoras/${seg(id)}/configuracion`),
  guardarConfiguracion: (id, datos) => pedir(`/refrigeradoras/${seg(id)}/configuracion`, { metodo: 'PUT', cuerpo: datos }),
  crearSensor: (datos) => pedir('/sensores', { metodo: 'POST', cuerpo: datos }),
  actualizarSensor: (id, datos) => pedir(`/sensores/${seg(id)}`, { metodo: 'PUT', cuerpo: datos }),
  obtenerEstado: () => pedir('/estado'), // HU06
  // HU12 / HU13 / HU04
  listarAlertas: ({ abiertas = false, limite = 100 } = {}) => pedir(`/alertas?limite=${Number.parseInt(limite, 10) || 100}${abiertas ? '&abiertas=1' : ''}`),
  atenderAlerta: (id) => pedir(`/alertas/${seg(id)}/atender`, { metodo: 'POST' }),
};
