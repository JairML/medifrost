// Errores de negocio que las rutas convierten en códigos HTTP.

class ErrorNoEncontrado extends Error {
  constructor(mensaje) { super(mensaje); this.status = 404; }
}

class ErrorConflicto extends Error {
  constructor(mensaje) { super(mensaje); this.status = 409; }
}

module.exports = { ErrorNoEncontrado, ErrorConflicto };
