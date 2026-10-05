// Repositorio real sobre Supabase (PostgreSQL). Tarea T07 – Jair Menéndez.
// Usa la clave service_role: SOLO en el backend, nunca en el frontend ni en el ESP32.
const { createClient } = require('@supabase/supabase-js');
const { ErrorConflicto, ErrorNoEncontrado } = require('../errores');

const MENSAJES_UNICIDAD = {
  sensor_codigo_key: 'Ya existe un sensor con ese código.',
  sensor_dispositivo_id_key: 'Ese dispositivo ya está registrado.',
  sensor_refrigeradora_id_key: 'Esa refrigeradora ya tiene un sensor vinculado.',
};

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
  };
}

module.exports = { crearRepositorioSupabase, traducirError };
