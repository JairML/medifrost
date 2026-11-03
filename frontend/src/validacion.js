// Validación en el navegador (la misma regla que el backend, para avisar antes de enviar).
// HU11 – Tarea T17 (Domenico Chang). La validación definitiva siempre la hace el backend.
export function validarConfiguracion({ temp_min, temp_max, tolerancia_min }) {
  const errores = [];
  const min = Number(temp_min);
  const max = Number(temp_max);
  const tol = Number(tolerancia_min);

  if (temp_min === '' || Number.isNaN(min)) errores.push('La temperatura mínima debe ser un número.');
  if (temp_max === '' || Number.isNaN(max)) errores.push('La temperatura máxima debe ser un número.');
  if (tolerancia_min === '' || Number.isNaN(tol)) errores.push('La tolerancia debe ser un número de minutos.');
  if (!errores.length) {
    if (min >= max) errores.push('La temperatura mínima debe ser menor que la máxima.');
    if (!Number.isInteger(tol) || tol < 1 || tol > 60) errores.push('La tolerancia debe ser un número entero entre 1 y 60 minutos.');
  }
  return errores;
}
