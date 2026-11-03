// Repositorio en memoria: se usa en las pruebas automáticas y en el modo demo
// (USE_MEMORY_DB=true) cuando no hay conexión a Supabase. Tiene las mismas
// reglas de unicidad que la base de datos real.
const { randomUUID } = require('node:crypto');
const { ErrorConflicto, ErrorNoEncontrado } = require('../errores');
const { CONFIG_POR_DEFECTO } = require('../constantes');

function crearRepositorioMemoria() {
  const refrigeradoras = new Map();
  const sensores = new Map();
  const lecturas = []; // HU06: lecturas en memoria (pruebas y modo demo)
  const alertas = new Map(); // HU12, HU13, HU04
  const eventos = []; // HU04: eventos del nodo
  let siguienteEvento = 1;
  const usuarios = new Map(); // HU20
  const ABIERTAS = ['pendiente', 'activa', 'atendida'];

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

    // HU02/HU06: en Supabase las inserta el ESP32; aquí las usan las pruebas y el simulador del modo demo.
    async registrarLectura({ dispositivo_id, temperatura = null, estado = 'ok', medido_en = new Date().toISOString(), alimentacion = null, bateria_pct = null }) {
      if (lecturas.some((l) => l.dispositivo_id === dispositivo_id && l.medido_en === medido_en)) {
        throw new ErrorConflicto('La lectura ya fue registrada.');
      }
      const nueva = { dispositivo_id, temperatura, estado, medido_en, alimentacion, bateria_pct };
      lecturas.push(nueva);
      return copia(nueva);
    },

    async ultimaLectura(dispositivoId) {
      let ultima = null;
      for (const l of lecturas) {
        if (l.dispositivo_id === dispositivoId && (!ultima || l.medido_en > ultima.medido_en)) ultima = l;
      }
      return copia(ultima);
    },

    // ---- Alertas (HU12, HU13, HU04) ----
    async crearAlerta(datos) {
      const abierta = [...alertas.values()].find((a) => a.refrigeradora_id === datos.refrigeradora_id && a.tipo === datos.tipo && ABIERTAS.includes(a.estado));
      if (ABIERTAS.includes(datos.estado || 'pendiente') && abierta) {
        throw new ErrorConflicto('Ya hay una alerta abierta de ese tipo para la refrigeradora.');
      }
      const nueva = {
        id: randomUUID(), estado: 'pendiente', sentido: null, notificada_en: null, ultimo_envio_en: null, envios: 0,
        valor_extremo: null, ultimo_valor: null, bateria_pct: null, atendida_en: null, atendida_por: null, cerrada_en: null,
        ...datos, creado_en: new Date().toISOString(),
      };
      alertas.set(nueva.id, nueva);
      return copia(nueva);
    },

    async actualizarAlerta(id, cambios) {
      const actual = alertas.get(id);
      if (!actual) throw new ErrorNoEncontrado('La alerta no existe.');
      const actualizada = { ...actual, ...cambios };
      alertas.set(id, actualizada);
      return copia(actualizada);
    },

    async obtenerAlerta(id) {
      return copia(alertas.get(id));
    },

    async alertasAbiertas(refrigeradoraId) {
      return [...alertas.values()].filter((a) => a.refrigeradora_id === refrigeradoraId && ABIERTAS.includes(a.estado)).map(copia);
    },

    async listarAlertas({ estados = null, refrigeradoraId = null, limite = 50 } = {}) {
      return [...alertas.values()]
        .filter((a) => (!estados || estados.includes(a.estado)) && (!refrigeradoraId || a.refrigeradora_id === refrigeradoraId))
        .sort((a, b) => String(b.inicio_en).localeCompare(String(a.inicio_en)))
        .slice(0, limite)
        .map(copia);
    },

    // ---- Eventos del nodo (HU04); en Supabase los inserta el ESP32 ----
    async registrarEvento({ dispositivo_id, tipo, bateria_pct = null, ocurrido_en = new Date().toISOString() }) {
      if (eventos.some((e) => e.dispositivo_id === dispositivo_id && e.tipo === tipo && e.ocurrido_en === ocurrido_en)) {
        throw new ErrorConflicto('El evento ya fue registrado.');
      }
      const nuevo = { id: siguienteEvento++, dispositivo_id, tipo, bateria_pct, ocurrido_en, procesado_en: null };
      eventos.push(nuevo);
      return copia(nuevo);
    },

    async eventosPendientes() {
      return eventos.filter((e) => !e.procesado_en).map(copia);
    },

    async marcarEventoProcesado(id, fecha = new Date().toISOString()) {
      const e = eventos.find((x) => x.id === id);
      if (e) e.procesado_en = fecha;
    },

    // ---- Usuarios (HU20) ----
    async buscarUsuarioPorCorreo(correo) {
      const c = String(correo).toLowerCase();
      return copia([...usuarios.values()].find((u) => u.correo === c));
    },

    async crearUsuario({ correo, nombre, rol, hash_contrasena }) {
      const c = String(correo).trim().toLowerCase();
      if ([...usuarios.values()].some((u) => u.correo === c)) throw new ErrorConflicto('Ya existe un usuario con ese correo.');
      const nuevo = {
        id: randomUUID(), correo: c, nombre, rol, hash_contrasena,
        intentos_fallidos: 0, bloqueado_hasta: null, activo: true, creado_en: new Date().toISOString(),
      };
      usuarios.set(nuevo.id, nuevo);
      return copia(nuevo);
    },

    async actualizarUsuario(id, cambios) {
      const actual = usuarios.get(id);
      if (!actual) throw new ErrorNoEncontrado('El usuario no existe.');
      const actualizado = { ...actual, ...cambios };
      usuarios.set(id, actualizado);
      return copia(actualizado);
    },
  };
}

module.exports = { crearRepositorioMemoria };
