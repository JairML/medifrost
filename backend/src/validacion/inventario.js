// HU21 – Registrar refrigeradoras y sensores con sus datos de calibración (RF08, RNF04)
// Tarea T13 (Domenico Chang) · Pruebas T15 (Kheyla Cóndor)

const DIAS_AVISO_VENCIMIENTO = 30;
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

function textoLimpio(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function esFechaValida(texto) {
  if (!FECHA_ISO.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

/** Valida los datos de una refrigeradora (nombre obligatorio, máx. 80 caracteres). */
function validarRefrigeradora(datos, { parcial = false } = {}) {
  const errores = [];
  const valor = {};
  const entrada = datos ?? {};

  if (!parcial || entrada.nombre !== undefined) {
    const nombre = textoLimpio(entrada.nombre);
    if (!nombre) errores.push('El nombre de la refrigeradora es obligatorio.');
    else if (nombre.length > 80) errores.push('El nombre no puede tener más de 80 caracteres.');
    else valor.nombre = nombre;
  }
  if (entrada.ubicacion !== undefined) valor.ubicacion = textoLimpio(entrada.ubicacion) || null;
  if (entrada.activa !== undefined) {
    if (typeof entrada.activa !== 'boolean') errores.push('El campo «activa» debe ser verdadero o falso.');
    else valor.activa = entrada.activa;
  }
  return errores.length ? { valido: false, errores } : { valido: true, errores: [], valor };
}

/** Valida los datos de un sensor y de su certificado de calibración. */
function validarSensor(datos) {
  const errores = [];
  const entrada = datos ?? {};
  const codigo = textoLimpio(entrada.codigo);
  const dispositivo_id = textoLimpio(entrada.dispositivo_id);
  const fecha_calibracion = textoLimpio(entrada.fecha_calibracion) || null;
  const vence_calibracion = textoLimpio(entrada.vence_calibracion) || null;
  const nro_certificado = textoLimpio(entrada.nro_certificado) || null;
  const refrigeradora_id = textoLimpio(entrada.refrigeradora_id) || null;

  if (!codigo) errores.push('El código del sensor es obligatorio.');
  if (!dispositivo_id) errores.push('El ID del dispositivo es obligatorio.');
  if (fecha_calibracion && !esFechaValida(fecha_calibracion)) errores.push('La fecha de calibración no es válida (AAAA-MM-DD).');
  if (vence_calibracion && !esFechaValida(vence_calibracion)) errores.push('La fecha de vencimiento no es válida (AAAA-MM-DD).');
  if (fecha_calibracion && vence_calibracion && esFechaValida(fecha_calibracion) && esFechaValida(vence_calibracion)
      && vence_calibracion < fecha_calibracion) {
    errores.push('El vencimiento de la calibración no puede ser anterior a la fecha de calibración.');
  }

  if (errores.length) return { valido: false, errores };
  return {
    valido: true,
    errores: [],
    valor: { codigo, dispositivo_id, refrigeradora_id, fecha_calibracion, nro_certificado, vence_calibracion },
  };
}

/**
 * Estado de la calibración para el aviso del dashboard (criterio HU21-3).
 * @returns {'sin_datos'|'vigente'|'por_vencer'|'vencida'}
 */
function estadoCalibracion(vence_calibracion, hoy = new Date()) {
  if (!vence_calibracion) return 'sin_datos';
  const hoyIso = hoy.toISOString().slice(0, 10);
  if (vence_calibracion < hoyIso) return 'vencida';
  const limite = new Date(`${hoyIso}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + DIAS_AVISO_VENCIMIENTO);
  return vence_calibracion <= limite.toISOString().slice(0, 10) ? 'por_vencer' : 'vigente';
}

module.exports = { validarRefrigeradora, validarSensor, estadoCalibracion, esFechaValida, DIAS_AVISO_VENCIMIENTO };
