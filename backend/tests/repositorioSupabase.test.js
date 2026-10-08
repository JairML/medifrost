// Pruebas del traductor de errores de Supabase (no se conecta a internet).
const { traducirError, crearRepositorioSupabase } = require('../src/db/repositorioSupabase');

describe('traducirError (repositorio Supabase)', () => {
  test('un duplicado de dispositivo (23505) se convierte en conflicto 409', () => {
    const e = traducirError({ code: '23505', message: 'duplicate key value violates unique constraint "sensor_dispositivo_id_key"' });
    expect(e.status).toBe(409);
    expect(e.message).toBe('Ese dispositivo ya está registrado.');
  });
  test('una refrigeradora inexistente (23503) se convierte en 404', () => {
    expect(traducirError({ code: '23503', message: 'fk' }).status).toBe(404);
  });
  test('otros errores se convierten en 500', () => {
    expect(traducirError({ code: 'XX000', message: 'falla' }).status).toBe(500);
  });
  test('exige las credenciales de Supabase', () => {
    expect(() => crearRepositorioSupabase({})).toThrow('Faltan SUPABASE_URL');
  });
});
