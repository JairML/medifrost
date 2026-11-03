// HU20-2: tras 5 intentos fallidos se bloquea el acceso por 5 minutos. Tarea T29 – Domenico Chang.
// Lógica pura (sin base de datos): recibe el usuario y la hora, devuelve los cambios a guardar.

const MAX_INTENTOS = 5;
const MINUTOS_BLOQUEO = 5;

function estaBloqueado(usuario, ahora = new Date()) {
  return Boolean(usuario.bloqueado_hasta) && new Date(usuario.bloqueado_hasta).getTime() > ahora.getTime();
}

function minutosRestantes(usuario, ahora = new Date()) {
  if (!estaBloqueado(usuario, ahora)) return 0;
  return Math.ceil((new Date(usuario.bloqueado_hasta).getTime() - ahora.getTime()) / 60000);
}

/** Cambios a guardar después de una contraseña incorrecta. */
function registrarFallo(usuario, ahora = new Date()) {
  // Si ya pasó un bloqueo anterior, se empieza a contar de nuevo
  const bloqueoVencido = usuario.bloqueado_hasta && !estaBloqueado(usuario, ahora);
  const intentos = (bloqueoVencido ? 0 : usuario.intentos_fallidos || 0) + 1;
  if (intentos >= MAX_INTENTOS) {
    return {
      intentos_fallidos: intentos,
      bloqueado_hasta: new Date(ahora.getTime() + MINUTOS_BLOQUEO * 60000).toISOString(),
    };
  }
  return { intentos_fallidos: intentos, bloqueado_hasta: null };
}

/** Cambios a guardar después de un ingreso correcto. */
const registrarExito = () => ({ intentos_fallidos: 0, bloqueado_hasta: null });

module.exports = { estaBloqueado, minutosRestantes, registrarFallo, registrarExito, MAX_INTENTOS, MINUTOS_BLOQUEO };
