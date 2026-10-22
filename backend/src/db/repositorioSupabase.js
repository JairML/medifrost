// Repositorio real sobre Supabase (PostgreSQL). Tarea T07 – Jair Menéndez.
// Usa la clave service_role: SOLO en el backend, nunca en el frontend ni en el ESP32.
const { createClient } = require('@supabase/supabase-js');
const { ErrorConflicto, ErrorNoEncontrado } = require('../errores');

const MENSAJES_UNICIDAD = {
  sensor_codigo_key: 'Ya existe un sensor con ese código.',
  sensor_dispositivo_id_key: 'Ese dispositivo ya está registrado.',
  sensor_refrigeradora_id_key: 'Esa refrigeradora ya tiene un sensor vinculado.',
  alerta_abierta_unica: 'Ya hay una alerta abierta de ese tipo para la refrigeradora.',
  usuario_correo_key: 'Ya existe un usuario con ese correo.',
};

const ESTADOS_ABIERTOS = ['pendiente', 'activa', 'atendida'];

function traducirError(error) {
  if (!error) return null;
  if (error.code === '23505') {
    const restriccion = Object.keys(MENSAJES_UNICIDAD).find((k) => (error.message || '').includes(k));
    return new ErrorConflicto(MENSAJES_UNICIDAD[restriccion] || 'El registro ya existe.');
  }
  if (error.code === '23503') return new ErrorNoEncontrado('La refrigeradora indicada no existe.');
  if (error.code === 'PGRST116') return new ErrorNoEncontrado('El registro no existe.');
  const e = new Error(error.message || 'Error de base de datos');
  e.status = 500;
  return e;
}

async function ejecutar(consulta) {
  const { data, error } = await consulta;
  if (error) throw traducirError(error);
  return data;
}

function crearRepositorioSupabase({ url, claveServicio }) {
  if (!url || !claveServicio) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el archivo .env');
  }
  const db = createClient(url, claveServicio, { auth: { persistSession: false } });

  return {
    listarRefrigeradoras: () => ejecutar(db.from('refrigeradora').select('*').order('creado_en')),
    obtenerRefrigeradora: async (id) => {
      const { data, error } = await db.from('refrigeradora').select('*').eq('id', id).maybeSingle();
      if (error) throw traducirError(error);
      return data;
    },
    crearRefrigeradora: (datos) => ejecutar(db.from('refrigeradora').insert(datos).select().single()),
    actualizarRefrigeradora: (id, cambios) => ejecutar(db.from('refrigeradora').update(cambios).eq('id', id).select().single()),
    listarSensores: () => ejecutar(db.from('sensor').select('*').order('creado_en')),
    obtenerSensor: async (id) => {
      const { data, error } = await db.from('sensor').select('*').eq('id', id).maybeSingle();
      if (error) throw traducirError(error);
      return data;
    },
    crearSensor: (datos) => ejecutar(db.from('sensor').insert(datos).select().single()),
    actualizarSensor: (id, datos) => ejecutar(db.from('sensor').update(datos).eq('id', id).select().single()),
    // HU06: última lectura de un dispositivo (el backend usa la clave secreta, que sí puede leer)
    ultimaLectura: async (dispositivoId) => {
      const { data, error } = await db.from('lectura')
        .select('dispositivo_id, temperatura, estado, medido_en, alimentacion, bateria_pct')
        .eq('dispositivo_id', dispositivoId)
        .order('medido_en', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw traducirError(error);
      return data;
    },

    // ---- Alertas (HU12, HU13, HU04): solo el backend puede leerlas y escribirlas (RLS) ----
    crearAlerta: (datos) => ejecutar(db.from('alerta').insert(datos).select().single()),
    actualizarAlerta: (id, cambios) => ejecutar(db.from('alerta').update(cambios).eq('id', id).select().single()),
    obtenerAlerta: async (id) => {
      const { data, error } = await db.from('alerta').select('*').eq('id', id).maybeSingle();
      if (error) throw traducirError(error);
      return data;
    },
    alertasAbiertas: (refrigeradoraId) => ejecutar(
      db.from('alerta').select('*').eq('refrigeradora_id', refrigeradoraId).in('estado', ESTADOS_ABIERTOS),
    ),
    listarAlertas: ({ estados = null, refrigeradoraId = null, limite = 50 } = {}) => {
      let consulta = db.from('alerta').select('*').order('inicio_en', { ascending: false }).limit(limite);
      if (estados) consulta = consulta.in('estado', estados);
      if (refrigeradoraId) consulta = consulta.eq('refrigeradora_id', refrigeradoraId);
      return ejecutar(consulta);
    },

    // ---- Eventos del nodo (HU04): los inserta el ESP32; el backend los marca como procesados ----
    eventosPendientes: () => ejecutar(
      db.from('evento_nodo').select('*').is('procesado_en', null).order('id', { ascending: true }).limit(100),
    ),
    marcarEventoProcesado: async (id, fecha = new Date().toISOString()) => {
      const { error } = await db.from('evento_nodo').update({ procesado_en: fecha }).eq('id', id);
      if (error) throw traducirError(error);
    },

    // ---- Usuarios (HU20): la tabla solo la lee el backend (RLS sin políticas) ----
    buscarUsuarioPorCorreo: async (correo) => {
      const { data, error } = await db.from('usuario').select('*').eq('correo', String(correo).toLowerCase()).maybeSingle();
      if (error) throw traducirError(error);
      return data;
    },
    crearUsuario: ({ correo, nombre, rol, hash_contrasena }) => ejecutar(
      db.from('usuario').insert({ correo: String(correo).trim().toLowerCase(), nombre, rol, hash_contrasena }).select().single(),
    ),
    actualizarUsuario: (id, cambios) => ejecutar(db.from('usuario').update(cambios).eq('id', id).select().single()),
  };
}

module.exports = { crearRepositorioSupabase, traducirError };
