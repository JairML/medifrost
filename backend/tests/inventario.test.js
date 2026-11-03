// CP-32 (Unitaria) – HU21: validaciones de refrigeradoras, sensores y calibración. Tarea T15 – Kheyla Cóndor
const { validarRefrigeradora, validarSensor, estadoCalibracion, esFechaValida } = require('../src/validacion/inventario');

describe('CP-32 · validarRefrigeradora (HU21)', () => {
  test('acepta nombre y ubicación, y limpia espacios', () => {
    const r = validarRefrigeradora({ nombre: '  Refri 1 ', ubicacion: ' Mostrador ' });
    expect(r).toEqual({ valido: true, errores: [], valor: { nombre: 'Refri 1', ubicacion: 'Mostrador' } });
  });

  test('exige el nombre', () => {
    expect(validarRefrigeradora({ nombre: '   ' }).errores).toContain('El nombre de la refrigeradora es obligatorio.');
  });

  test('rechaza nombres de más de 80 caracteres', () => {
    expect(validarRefrigeradora({ nombre: 'x'.repeat(81) }).valido).toBe(false);
  });

  test('en modo parcial permite solo desactivar', () => {
    expect(validarRefrigeradora({ activa: false }, { parcial: true }))
      .toEqual({ valido: true, errores: [], valor: { activa: false } });
  });

  test('rechaza «activa» que no sea booleano', () => {
    expect(validarRefrigeradora({ activa: 'no' }, { parcial: true }).valido).toBe(false);
  });
});

describe('CP-32 · validarSensor (HU21)', () => {
  const base = { codigo: 'DS18B20-001', dispositivo_id: 'MF-NODO-01' };

  test('acepta un sensor con calibración completa', () => {
    const r = validarSensor({ ...base, fecha_calibracion: '2026-09-01', vence_calibracion: '2027-09-01', nro_certificado: 'LAB-123' });
    expect(r.valido).toBe(true);
    expect(r.valor.nro_certificado).toBe('LAB-123');
  });

  test('exige código y dispositivo', () => {
    const r = validarSensor({});
    expect(r.errores).toEqual(expect.arrayContaining([
      'El código del sensor es obligatorio.',
      'El ID del dispositivo es obligatorio.',
    ]));
  });

  test('rechaza fechas con formato inválido o inexistentes', () => {
    expect(validarSensor({ ...base, fecha_calibracion: '01/09/2026' }).valido).toBe(false);
    expect(validarSensor({ ...base, vence_calibracion: '2026-02-30' }).valido).toBe(false);
  });

  test('rechaza un vencimiento anterior a la calibración', () => {
    const r = validarSensor({ ...base, fecha_calibracion: '2026-09-01', vence_calibracion: '2026-08-01' });
    expect(r.errores).toContain('El vencimiento de la calibración no puede ser anterior a la fecha de calibración.');
  });

  test('esFechaValida reconoce fechas reales', () => {
    expect(esFechaValida('2026-10-09')).toBe(true);
    expect(esFechaValida('2026-13-01')).toBe(false);
  });
});

describe('CP-32 · estadoCalibracion (criterio HU21-3)', () => {
  const hoy = new Date('2026-10-09T12:00:00Z');

  test('sin fecha de vencimiento → sin_datos', () => {
    expect(estadoCalibracion(null, hoy)).toBe('sin_datos');
  });
  test('vencida antes de hoy → vencida', () => {
    expect(estadoCalibracion('2026-10-08', hoy)).toBe('vencida');
  });
  test('vence hoy o en los próximos 30 días → por_vencer', () => {
    expect(estadoCalibracion('2026-10-09', hoy)).toBe('por_vencer');
    expect(estadoCalibracion('2026-11-08', hoy)).toBe('por_vencer');
  });
  test('vence en más de 30 días → vigente', () => {
    expect(estadoCalibracion('2026-11-09', hoy)).toBe('vigente');
  });
});
