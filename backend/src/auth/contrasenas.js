// HU20-1: las contraseñas se guardan SOLO como hash bcrypt. Tarea T29 – Domenico Chang.
// Se usa «bcryptjs» (JavaScript puro): se instala igual en Windows, Mac y Linux, sin compilar nada.
const bcrypt = require('bcryptjs');

const COSTO = 10;            // 2^10 rondas: ~70 ms por verificación, lento a propósito contra ataques
const LONGITUD_MINIMA = 8;

/** Reglas mínimas de una contraseña nueva. */
function validarContrasena(contrasena) {
  const errores = [];
  if (typeof contrasena !== 'string' || contrasena.length < LONGITUD_MINIMA) {
    errores.push(`La contraseña debe tener al menos ${LONGITUD_MINIMA} caracteres.`);
  }
  if (typeof contrasena === 'string' && contrasena.length > 72) {
    errores.push('La contraseña no puede tener más de 72 caracteres.'); // límite de bcrypt
  }
  return { valido: errores.length === 0, errores };
}

const hashear = (contrasena) => bcrypt.hash(contrasena, COSTO);
const verificar = (contrasena, hash) => bcrypt.compare(String(contrasena ?? ''), hash);

// Hash de relleno: si el correo no existe se compara igual contra él, para que la respuesta
// tarde lo mismo y no se pueda adivinar qué correos están registrados.
const HASH_RELLENO = bcrypt.hashSync('relleno-medifrost', COSTO);

module.exports = { hashear, verificar, validarContrasena, HASH_RELLENO, LONGITUD_MINIMA };
