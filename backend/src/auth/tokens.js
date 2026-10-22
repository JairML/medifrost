// HU20-1: la sesión usa un token JWT con expiración. Tarea T29 – Domenico Chang.
const jwt = require('jsonwebtoken');

const EXPIRA_POR_DEFECTO = '8h'; // una jornada de trabajo en la botica

/** Crea el token de sesión de un usuario. */
function emitirToken(usuario, { secreto, expiraEn = EXPIRA_POR_DEFECTO, ahora = new Date() }) {
  if (!secreto) throw new Error('Falta el secreto para firmar los tokens (JWT_SECRET).');
  return jwt.sign(
    { rol: usuario.rol, nombre: usuario.nombre, correo: usuario.correo, iat: Math.floor(ahora.getTime() / 1000) },
    secreto,
    { subject: String(usuario.id), expiresIn: expiraEn, algorithm: 'HS256' },
  );
}

/**
 * Verifica un token. Devuelve { usuario } si es válido o { error: 'expirado' | 'invalido' }.
 */
function verificarToken(token, { secreto, ahora = new Date() }) {
  try {
    const datos = jwt.verify(token, secreto, { algorithms: ['HS256'], clockTimestamp: Math.floor(ahora.getTime() / 1000) });
    return { usuario: { id: datos.sub, rol: datos.rol, nombre: datos.nombre, correo: datos.correo }, expira: new Date(datos.exp * 1000) };
  } catch (e) {
    return { error: e.name === 'TokenExpiredError' ? 'expirado' : 'invalido' };
  }
}

module.exports = { emitirToken, verificarToken, EXPIRA_POR_DEFECTO };
