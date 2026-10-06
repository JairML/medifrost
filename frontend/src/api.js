// Cliente de la API de MediFrost.
// El rol se envía en «x-rol» de forma temporal hasta que exista el login (HU20, Sprint 2).
const BASE = import.meta.env.VITE_API_URL || '';

let rolActual = 'administrador';
export function fijarRol(rol) { rolActual = rol; }

async function pedir(ruta, { metodo = 'GET', cuerpo } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}/api${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'x-rol': rolActual },
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
    throw error;
  }
  return datos;
}

export const api = {
  listarRefrigeradoras: () => pedir('/refrigeradoras'),
  crearRefrigeradora: (datos) => pedir('/refrigeradoras', { metodo: 'POST', cuerpo: datos }),
  actualizarRefrigeradora: (id, datos) => pedir(`/refrigeradoras/${id}`, { metodo: 'PUT', cuerpo: datos }),
  obtenerConfiguracion: (id) => pedir(`/refrigeradoras/${id}/configuracion`),
  guardarConfiguracion: (id, datos) => pedir(`/refrigeradoras/${id}/configuracion`, { metodo: 'PUT', cuerpo: datos }),
  crearSensor: (datos) => pedir('/sensores', { metodo: 'POST', cuerpo: datos }),
  actualizarSensor: (id, datos) => pedir(`/sensores/${id}`, { metodo: 'PUT', cuerpo: datos }),
};
