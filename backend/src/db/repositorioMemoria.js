// Repositorio en memoria: se usa en las pruebas automáticas y en el modo demo
// (USE_MEMORY_DB=true) cuando no hay conexión a Supabase. Tiene las mismas
// reglas de unicidad que la base de datos real.
const { randomUUID } = require('node:crypto');
const { ErrorConflicto, ErrorNoEncontrado } = require('../errores');
const { CONFIG_POR_DEFECTO } = require('../constantes');

function crearRepositorioMemoria() {
  const refrigeradoras = new Map();
  const sensores = new Map();

  const copia = (obj) => (obj ? { ...obj } : null);

  return {
    async listarRefrigeradoras() {
      return [...refrigeradoras.values()]
        .sort((a, b) => a.creado_en.localeCompare(b.creado_en))
        .map(copia);
    },

    async obtenerRefrigeradora(id) {
      return copia(refrigeradoras.get(id));
    },

    async crearRefrigeradora({ nombre, ubicacion = null }) {
      const ahora = new Date().toISOString();
      const nueva = { id: randomUUID(), nombre, ubicacion, ...CONFIG_POR_DEFECTO, activa: true, creado_en: ahora, actualizado_en: ahora };
      refrigeradoras.set(nueva.id, nueva);
      return copia(nueva);
    },

    async actualizarRefrigeradora(id, cambios) {
      const actual = refrigeradoras.get(id);
      if (!actual) throw new ErrorNoEncontrado('La refrigeradora no existe.');
      const actualizada = { ...actual, ...cambios, actualizado_en: new Date().toISOString() };
      refrigeradoras.set(id, actualizada);
      return copia(actualizada);
    },

    async listarSensores() {
      return [...sensores.values()].map(copia);
    },

    async obtenerSensor(id) {
      return copia(sensores.get(id));
    },

    async crearSensor(datos) {
      for (const s of sensores.values()) {
        if (s.codigo === datos.codigo) throw new ErrorConflicto('Ya existe un sensor con ese código.');
        if (s.dispositivo_id === datos.dispositivo_id) throw new ErrorConflicto('Ese dispositivo ya está registrado.');
        if (datos.refrigeradora_id && s.refrigeradora_id === datos.refrigeradora_id) {
          throw new ErrorConflicto('Esa refrigeradora ya tiene un sensor vinculado.');
        }
      }
      if (datos.refrigeradora_id && !refrigeradoras.has(datos.refrigeradora_id)) {
        throw new ErrorNoEncontrado('La refrigeradora indicada no existe.');
      }
      const nuevo = { id: randomUUID(), ...datos, creado_en: new Date().toISOString() };
      sensores.set(nuevo.id, nuevo);
      return copia(nuevo);
    },

    async actualizarSensor(id, datos) {
      const actual = sensores.get(id);
      if (!actual) throw new ErrorNoEncontrado('El sensor no existe.');
      for (const s of sensores.values()) {
        if (s.id === id) continue;
        if (s.codigo === datos.codigo) throw new ErrorConflicto('Ya existe un sensor con ese código.');
        if (s.dispositivo_id === datos.dispositivo_id) throw new ErrorConflicto('Ese dispositivo ya está registrado.');
        if (datos.refrigeradora_id && s.refrigeradora_id === datos.refrigeradora_id) {
          throw new ErrorConflicto('Esa refrigeradora ya tiene un sensor vinculado.');
        }
      }
      const actualizado = { ...actual, ...datos };
      sensores.set(id, actualizado);
      return copia(actualizado);
    },
  };
}

module.exports = { crearRepositorioMemoria };
