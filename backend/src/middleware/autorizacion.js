// Control de roles TEMPORAL para el Sprint 1.
// El inicio de sesión real (bcrypt + JWT) es la historia HU20 del Sprint 2.
// Mientras tanto, el frontend envía el rol elegido en el encabezado «x-rol»,
// lo que permite demostrar y probar el criterio HU11-1:
// «Solo la DT o el administrador puede modificar el rango y la tolerancia».

const ROLES = ['administrador', 'directora_tecnica', 'tecnico'];

function usuarioDemo(req, _res, next) {
  const rol = String(req.get('x-rol') || '').toLowerCase();
  req.usuario = { rol: ROLES.includes(rol) ? rol : 'tecnico' };
  next();
}

function autorizar(rolesPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ errores: ['No tienes permiso para realizar esta acción.'] });
    }
    next();
  };
}

module.exports = { usuarioDemo, autorizar, ROLES };
