// HU06 – Estado de cada refrigeradora para el dashboard (normal / alerta / sin señal).
// Tarea T09 (Jair Menéndez) · Pruebas CP-12 (Kheyla Cóndor)
// Lógica pura: no depende de la base de datos, por eso se prueba con datos de ejemplo.

const MINUTOS_SIN_SENAL = 10; // mismo umbral que la alerta «sin señal» de HU13

/**
 * Calcula el estado que muestra la tarjeta del dashboard.
 * @param {object} p
 * @param {object} p.refrigeradora  con temp_min y temp_max
 * @param {object|null} p.sensor    sensor vinculado (o null)
 * @param {object|null} p.lectura   última lectura { temperatura, estado, medido_en }
 * @param {Date} [p.ahora]
 * @returns {{ estado: 'normal'|'alerta'|'sin_senal'|'sin_sensor', motivo: string, minutos_desde_lectura: number|null }}
 */
function calcularEstado({ refrigeradora, sensor, lectura, ahora = new Date() }) {
  if (!sensor) {
    return { estado: 'sin_sensor', motivo: 'No tiene un sensor vinculado.', minutos_desde_lectura: null };
  }
  if (!lectura) {
    return { estado: 'sin_senal', motivo: 'El nodo todavía no envió lecturas.', minutos_desde_lectura: null };
  }

  const minutos = Math.max(0, Math.floor((ahora.getTime() - new Date(lectura.medido_en).getTime()) / 60000));
  if (minutos >= MINUTOS_SIN_SENAL) {
    return { estado: 'sin_senal', motivo: `Sin datos hace ${minutos} min.`, minutos_desde_lectura: minutos };
  }
  if (lectura.estado === 'error_sensor' || lectura.temperatura === null || lectura.temperatura === undefined) {
    return { estado: 'alerta', motivo: 'Error de sensor: revisar la conexión de la sonda.', minutos_desde_lectura: minutos };
  }

  const t = Number(lectura.temperatura);
  const min = Number(refrigeradora.temp_min);
  const max = Number(refrigeradora.temp_max);
  if (t < min) return { estado: 'alerta', motivo: `Por debajo del mínimo (${min} °C).`, minutos_desde_lectura: minutos };
  if (t > max) return { estado: 'alerta', motivo: `Por encima del máximo (${max} °C).`, minutos_desde_lectura: minutos };
  return { estado: 'normal', motivo: `Dentro del rango ${min} – ${max} °C.`, minutos_desde_lectura: minutos };
}

module.exports = { calcularEstado, MINUTOS_SIN_SENAL };
