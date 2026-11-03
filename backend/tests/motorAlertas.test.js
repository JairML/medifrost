// CP-13 (Unitaria) – Motor de reglas de alertas: un caso por criterio de aceptación.
// HU12 (temperatura), HU13 (sin señal), HU04 (energía). Tareas T22 y T25 – Kheyla Cóndor
const { evaluarTemperatura, evaluarSinSenal, evaluarEvento } = require('../src/alertas/motor');

const REFRI = { id: 'r1', temp_min: 2, temp_max: 8, tolerancia_min: 15 };
const SENSOR = { dispositivo_id: 'MF-NODO-01' };
const T0 = new Date('2026-10-20T15:00:00Z').getTime();
const min = (m) => new Date(T0 + m * 60000);
const lect = (m, temperatura, estado = 'ok') => ({ temperatura, estado, medido_en: min(m).toISOString() });
const alerta = (extra) => ({ id: 'a1', tipo: 'temperatura', estado: 'pendiente', sentido: 'alta', inicio_en: min(0).toISOString(), envios: 0, valor_extremo: 9, ...extra });

describe('CP-13 · HU12-1: avisa cuando la temperatura sigue fuera de rango más que la tolerancia', () => {
  test('la primera lectura fuera de rango abre una alerta «pendiente» sin enviar correo', () => {
    const d = evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(0, 9.1), alerta: null, ahora: min(0) });
    expect(d.accion).toBe('crear');
    expect(d.correo).toBeUndefined();
    expect(d.alerta).toMatchObject({ tipo: 'temperatura', estado: 'pendiente', sentido: 'alta', inicio_en: min(0).toISOString() });
  });

  test('a los 14 min todavía no avisa; a los 15 min envía el primer correo', () => {
    const a = alerta();
    expect(evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(14, 9.3), alerta: a, ahora: min(14) }).correo).toBeUndefined();
    const d = evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(15, 9.3), alerta: a, ahora: min(15) });
    expect(d.correo).toBe('alertaTemperatura');
    expect(d.cambios).toMatchObject({ estado: 'activa', envios: 1, ultimo_envio_en: min(15).toISOString() });
  });

  test('guarda la temperatura más alta (excursión alta) o la más baja (excursión baja)', () => {
    expect(evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(5, 10.4), alerta: alerta({ valor_extremo: 9.5 }), ahora: min(5) }).cambios.valor_extremo).toBe(10.4);
    expect(evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(5, 9.0), alerta: alerta({ valor_extremo: 9.5 }), ahora: min(5) }).cambios.valor_extremo).toBe(9.5);
    const baja = alerta({ sentido: 'baja', valor_extremo: 1.5 });
    expect(evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(5, 0.9), alerta: baja, ahora: min(5) }).cambios.valor_extremo).toBe(0.9);
  });

  test('2 °C y 8 °C exactos están dentro del rango (no abren alerta)', () => {
    expect(evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(0, 8), alerta: null, ahora: min(0) }).accion).toBe('ninguna');
    expect(evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(0, 2), alerta: null, ahora: min(0) }).accion).toBe('ninguna');
  });

  test('un error de sensor o una lectura vieja (sin señal) no deciden nada sobre la temperatura', () => {
    expect(evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(0, null, 'error_sensor'), alerta: null, ahora: min(0) }).accion).toBe('ninguna');
    expect(evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(0, 9.5), alerta: null, ahora: min(10) }).accion).toBe('ninguna');
  });
});

describe('CP-13 · HU12-2: se repite cada 30 min hasta que la marquen como atendida', () => {
  const activa = alerta({ estado: 'activa', envios: 1, notificada_en: min(15).toISOString(), ultimo_envio_en: min(15).toISOString() });

  test('a los 29 min del último correo no repite; a los 30 min sí', () => {
    expect(evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(44, 9.4), alerta: activa, ahora: min(44) }).correo).toBeUndefined();
    const d = evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(45, 9.4), alerta: activa, ahora: min(45) });
    expect(d.correo).toBe('alertaTemperatura');
    expect(d.cambios.envios).toBe(2);
  });

  test('si está atendida no se repite aunque pasen horas', () => {
    const atendida = { ...activa, estado: 'atendida' };
    expect(evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(200, 9.4), alerta: atendida, ahora: min(200) }).correo).toBeUndefined();
  });
});

describe('CP-13 · HU12-3: aviso de normalización al volver al rango', () => {
  test('una alerta activa o atendida se cierra y envía el aviso de normalización', () => {
    for (const estado of ['activa', 'atendida']) {
      const d = evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(60, 5.2), alerta: alerta({ estado, envios: 2 }), ahora: min(60) });
      expect(d.correo).toBe('normalizacionTemperatura');
      expect(d.cambios).toMatchObject({ estado: 'cerrada', cerrada_en: min(60).toISOString(), ultimo_valor: 5.2 });
    }
  });

  test('si vuelve antes de la tolerancia se descarta sin ningún correo (evita falsas alarmas)', () => {
    const d = evaluarTemperatura({ refrigeradora: REFRI, lectura: lect(6, 7.9), alerta: alerta(), ahora: min(6) });
    expect(d.correo).toBeUndefined();
    expect(d.cambios.estado).toBe('descartada');
  });
});

describe('CP-13 · HU13: alerta «sin señal» a los 10 min sin datos', () => {
  test('a los 9 min no avisa; a los 10 min avisa una vez', () => {
    expect(evaluarSinSenal({ refrigeradora: REFRI, sensor: SENSOR, lectura: lect(0, 4.5), alerta: null, ahora: min(9) }).accion).toBe('ninguna');
    const d = evaluarSinSenal({ refrigeradora: REFRI, sensor: SENSOR, lectura: lect(0, 4.5), alerta: null, ahora: min(10) });
    expect(d).toMatchObject({ accion: 'crear', correo: 'alertaSinSenal' });
    expect(d.alerta).toMatchObject({ tipo: 'sin_senal', estado: 'activa', inicio_en: min(0).toISOString(), ultimo_valor: 4.5 });
  });

  test('si ya avisó no vuelve a avisar en el minuto siguiente; repite a los 30 min si nadie la atiende', () => {
    const abierta = { id: 's1', tipo: 'sin_senal', estado: 'activa', envios: 1, ultimo_envio_en: min(10).toISOString(), inicio_en: min(0).toISOString() };
    expect(evaluarSinSenal({ refrigeradora: REFRI, sensor: SENSOR, lectura: lect(0, 4.5), alerta: abierta, ahora: min(11) }).accion).toBe('ninguna');
    expect(evaluarSinSenal({ refrigeradora: REFRI, sensor: SENSOR, lectura: lect(0, 4.5), alerta: abierta, ahora: min(40) }).correo).toBe('alertaSinSenal');
  });

  test('cuando vuelven los datos se cierra con el aviso «señal recuperada»', () => {
    const abierta = { id: 's1', tipo: 'sin_senal', estado: 'atendida', envios: 1, inicio_en: min(0).toISOString() };
    const d = evaluarSinSenal({ refrigeradora: REFRI, sensor: SENSOR, lectura: lect(25, 4.8), alerta: abierta, ahora: min(25) });
    expect(d).toMatchObject({ accion: 'actualizar', correo: 'senalRecuperada' });
    expect(d.cambios.estado).toBe('cerrada');
  });

  test('sin sensor vinculado o sin ninguna lectura previa no hay alerta', () => {
    expect(evaluarSinSenal({ refrigeradora: REFRI, sensor: null, lectura: null, ahora: min(60) }).accion).toBe('ninguna');
    expect(evaluarSinSenal({ refrigeradora: REFRI, sensor: SENSOR, lectura: null, ahora: min(60) }).accion).toBe('ninguna');
  });
});

describe('CP-13 · HU04: eventos de energía del nodo', () => {
  const ev = (tipo, bateria_pct = null) => ({ tipo, bateria_pct, ocurrido_en: min(0).toISOString() });

  test('corte de energía → alerta con correo; si se repite el evento no se duplica', () => {
    const [d] = evaluarEvento({ refrigeradora: REFRI, evento: ev('corte_energia', 90), abiertas: {}, ahora: min(0) });
    expect(d).toMatchObject({ tipo: 'corte_energia', accion: 'crear', correo: 'corteEnergia' });
    expect(d.alerta).toMatchObject({ estado: 'activa', bateria_pct: 90 });
    expect(evaluarEvento({ refrigeradora: REFRI, evento: ev('corte_energia'), abiertas: { corte_energia: { id: 'c1' } } })).toEqual([]);
  });

  test('batería baja solo si está por debajo de 20 %', () => {
    expect(evaluarEvento({ refrigeradora: REFRI, evento: ev('bateria_baja', 19), abiertas: {} })[0].correo).toBe('bateriaBaja');
    expect(evaluarEvento({ refrigeradora: REFRI, evento: ev('bateria_baja', 20), abiertas: {} })).toEqual([]);
  });

  test('energía restaurada cierra el corte (con correo) y la batería baja (sin correo)', () => {
    const d = evaluarEvento({
      refrigeradora: REFRI, evento: ev('energia_restaurada', 18), ahora: min(30),
      abiertas: { corte_energia: { id: 'c1', envios: 1 }, bateria_baja: { id: 'b1', envios: 1 } },
    });
    expect(d).toHaveLength(2);
    expect(d[0]).toMatchObject({ id: 'c1', correo: 'energiaRestaurada', cambios: { estado: 'cerrada' } });
    expect(d[1]).toMatchObject({ id: 'b1', cambios: { estado: 'cerrada' } });
    expect(d[1].correo).toBeUndefined();
  });

  test('energía restaurada sin un corte abierto no hace nada; un tipo desconocido tampoco', () => {
    expect(evaluarEvento({ refrigeradora: REFRI, evento: ev('energia_restaurada'), abiertas: {} })).toEqual([]);
    expect(evaluarEvento({ refrigeradora: REFRI, evento: ev('otro'), abiertas: {} })).toEqual([]);
  });
});
