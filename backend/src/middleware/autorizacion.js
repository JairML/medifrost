// Autenticación y control de roles. Sprint 2 – HU20, tarea T29 – Domenico Chang.
//
// Cada petición puede traer «Authorization: Bearer <token>» (lo entrega POST /api/auth/login).
// • autenticacion(): lee el token y deja el usuario en req.usuario (o null si no hay sesión).
// • requerirSesion: responde 401 si no hay sesión válida (rutas protegidas).
// • autorizar([...roles]): responde 403 si el rol no tiene permiso (HU11-1, HU21).
//
// Solo para las pruebas automáticas del Sprint 1 existe el «modo rol de prueba»
// (permitirRolDemo): sin token, el rol se toma del encabezado «x-rol», como antes.
// El servidor real (npm run dev / start / demo) NUNCA lo activa.
const { verificarToken } = require('../auth/tokens');

const ROLES = ['administrador', 'directora_tecnica', 'tecnico'];

function autenticacion({ secreto = null, permitirRolDemo = false, reloj = () => new Date() } = {}) {
  return (req, _res, next) => {
    req.usuario = null;
    const cabecera = String(req.get('authorization') || '');
    const [tipo, token] = cabecera.split(' ');
    if (tipo === 'Bearer' && token && secreto) {
      const r = verificarToken(token, { secreto, ahora: reloj() });
      if (r.usuario && ROLES.includes(r.usuario.rol)) req.usuario = r.usuario;
      else req.errorSesion = r.error || 'invalido';
      return next();
    }
    if (permitirRolDemo) {
      const rol = String(req.get('x-rol') || '').toLowerCase();
      req.usuario = { rol: ROLES.includes(rol) ? rol : 'tecnico' };
    }
    next();
  };
}

function requerirSesion(req, res, next) {
  if (req.usuario) return next();
  let mensaje = 'Debes iniciar sesión.';
  if (req.errorSesion === 'expirado') mensaje = 'Tu sesión expiró. Vuelve a iniciar sesión.';
  else if (req.errorSesion) mensaje = 'Tu sesión no es válida. Vuelve a iniciar sesión.';
  return res.status(401).json({ errores: [mensaje] });
}

function autorizar(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ errores: ['Debes iniciar sesión.'] });
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ errores: ['No tienes permiso para realizar esta acción.'] });
    }
    next();
  };
}

module.exports = { autenticacion, requerirSesion, autorizar, ROLES };
