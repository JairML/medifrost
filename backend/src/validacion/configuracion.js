// HU11 – Configurar rango permitido y tiempo de tolerancia (RF02)
// Tarea T16 (Ian Flores) · Pruebas T18 (Kheyla Cóndor)
const { CONFIG_POR_DEFECTO } = require('../constantes');

const LIMITE_TEMP_MIN = -30; // °C, límite físico razonable para una refrigeradora
const LIMITE_TEMP_MAX = 30;
const TOLERANCIA_MIN = 1;    // minutos
const TOLERANCIA_MAX = 60;

function esNumero(valor) {
  return typeof valor === 'number' && Number.isFinite(valor);
}

/**
 * Valida la configuración de alertas de una refrigeradora.
 * Criterio de aceptación HU11-2: no se permite un mínimo mayor o igual al máximo
 * ni una tolerancia fuera de 1–60 minutos.
 * @returns {{ valido: boolean, errores: string[], valor?: object }}
 */
function validarConfiguracion(datos) {
  const errores = [];
  const entrada = datos ?? {};
  const temp_min = typeof entrada.temp_min === 'string' && entrada.temp_min.trim() !== '' ? Number(entrada.temp_min) : entrada.temp_min;
  const temp_max = typeof entrada.temp_max === 'string' && entrada.temp_max.trim() !== '' ? Number(entrada.temp_max) : entrada.temp_max;
  const tolerancia_min = typeof entrada.tolerancia_min === 'string' && entrada.tolerancia_min.trim() !== '' ? Number(entrada.tolerancia_min) : entrada.tolerancia_min;

  if (!esNumero(temp_min)) errores.push('La temperatura mínima debe ser un número.');
  if (!esNumero(temp_max)) errores.push('La temperatura máxima debe ser un número.');
  if (!esNumero(tolerancia_min)) errores.push('La tolerancia debe ser un número de minutos.');

  if (esNumero(temp_min) && esNumero(temp_max)) {
    if (temp_min >= temp_max) errores.push('La temperatura mínima debe ser menor que la máxima.');
    if (temp_min < LIMITE_TEMP_MIN || temp_max > LIMITE_TEMP_MAX) {
      errores.push(`Las temperaturas deben estar entre ${LIMITE_TEMP_MIN} °C y ${LIMITE_TEMP_MAX} °C.`);
    }
  }
  if (esNumero(tolerancia_min)) {
    if (!Number.isInteger(tolerancia_min)) errores.push('La tolerancia debe ser un número entero de minutos.');
    else if (tolerancia_min < TOLERANCIA_MIN || tolerancia_min > TOLERANCIA_MAX) {
      errores.push(`La tolerancia debe estar entre ${TOLERANCIA_MIN} y ${TOLERANCIA_MAX} minutos.`);
    }
  }

  if (errores.length > 0) return { valido: false, errores };
  return {
    valido: true,
    errores: [],
    valor: { temp_min: Math.round(temp_min * 10) / 10, temp_max: Math.round(temp_max * 10) / 10, tolerancia_min },
  };
}

module.exports = { validarConfiguracion, CONFIG_POR_DEFECTO, TOLERANCIA_MIN, TOLERANCIA_MAX };
