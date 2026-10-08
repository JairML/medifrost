// CP-17 (Unitaria) – HU11: validación de rango y tolerancia. Tarea T18 – Kheyla Cóndor
const { validarConfiguracion } = require('../src/validacion/configuracion');

describe('CP-17 · validarConfiguracion (HU11)', () => {
  test('acepta la configuración por defecto 2–8 °C y 15 min', () => {
    const r = validarConfiguracion({ temp_min: 2, temp_max: 8, tolerancia_min: 15 });
    expect(r.valido).toBe(true);
    expect(r.valor).toEqual({ temp_min: 2, temp_max: 8, tolerancia_min: 15 });
  });

  test('acepta números enviados como texto desde un formulario', () => {
    const r = validarConfiguracion({ temp_min: '2.5', temp_max: '7.5', tolerancia_min: '20' });
    expect(r.valido).toBe(true);
    expect(r.valor).toEqual({ temp_min: 2.5, temp_max: 7.5, tolerancia_min: 20 });
  });

  test('redondea las temperaturas a un decimal', () => {
    expect(validarConfiguracion({ temp_min: 2.04, temp_max: 7.96, tolerancia_min: 15 }).valor)
      .toEqual({ temp_min: 2, temp_max: 8, tolerancia_min: 15 });
  });

  test('rechaza un mínimo igual al máximo (criterio HU11-2)', () => {
    const r = validarConfiguracion({ temp_min: 8, temp_max: 8, tolerancia_min: 15 });
    expect(r.valido).toBe(false);
    expect(r.errores).toContain('La temperatura mínima debe ser menor que la máxima.');
  });

  test('rechaza un mínimo mayor que el máximo (criterio HU11-2)', () => {
    expect(validarConfiguracion({ temp_min: 9, temp_max: 2, tolerancia_min: 15 }).valido).toBe(false);
  });

  test.each([0, 61, -5])('rechaza una tolerancia de %p minutos (fuera de 1–60)', (tol) => {
    const r = validarConfiguracion({ temp_min: 2, temp_max: 8, tolerancia_min: tol });
    expect(r.valido).toBe(false);
    expect(r.errores).toContain('La tolerancia debe estar entre 1 y 60 minutos.');
  });

  test.each([1, 60])('acepta los límites de tolerancia (%p min)', (tol) => {
    expect(validarConfiguracion({ temp_min: 2, temp_max: 8, tolerancia_min: tol }).valido).toBe(true);
  });

  test('rechaza una tolerancia con decimales', () => {
    expect(validarConfiguracion({ temp_min: 2, temp_max: 8, tolerancia_min: 15.5 }).valido).toBe(false);
  });

  test('rechaza valores que no son números', () => {
    const r = validarConfiguracion({ temp_min: 'abc', temp_max: null, tolerancia_min: undefined });
    expect(r.valido).toBe(false);
    expect(r.errores).toHaveLength(3);
  });

  test('rechaza temperaturas fuera de los límites físicos (-30 a 30 °C)', () => {
    expect(validarConfiguracion({ temp_min: -40, temp_max: 8, tolerancia_min: 15 }).valido).toBe(false);
    expect(validarConfiguracion({ temp_min: 2, temp_max: 45, tolerancia_min: 15 }).valido).toBe(false);
  });

  test('no falla si no recibe datos', () => {
    expect(validarConfiguracion(undefined).valido).toBe(false);
  });
});
