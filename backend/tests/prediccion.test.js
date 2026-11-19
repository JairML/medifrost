// CP-23 – HU23: modelo de predicción (tendencia de la temperatura y salud del sensor).
const request = require('supertest');
const { crearApp } = require('../src/app');
const { crearRepositorioMemoria } = require('../src/db/repositorioMemoria');
const { iniciarSimulador } = require('../src/demo/simuladorLecturas');
const { regresionLineal, predecirExcursion, saludSensor, UMBRAL_PREVENTIVO_MIN } = require('../src/prediccion/modelo');

const AHORA = new Date('2026-11-19T15:00:00Z');
const hace = (min) => new Date(AHORA.getTime() - min * 60000).toISOString();
/** n lecturas, una por minuto, terminando en «ahora»; temp(i) recibe los minutos antes de ahora */
const serie = (n, temp, extra = {}) => Array.from({ length: n }, (_, k) => {
  const min = n - 1 - k;
  return { temperatura: temp(min), estado: 'ok', medido_en: hace(min), ...extra };
});
const predecir = (lecturas, rango = { tempMin: 2, tempMax: 8 }) => predecirExcursion({ lecturas, ...rango, ahora: AHORA });

describe('CP-23 · regresionLineal', () => {
  test('recupera la pendiente y el intercepto de una recta exacta (R² = 1)', () => {
    const r = regresionLineal([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }]);
    expect(r.pendiente).toBeCloseTo(2);
    expect(r.intercepto).toBeCloseTo(1);
    expect(r.r2).toBeCloseTo(1);
  });

  test('con datos dispersos el R² es bajo', () => {
    const r = regresionLineal([{ x: 0, y: 5 }, { x: 1, y: 2 }, { x: 2, y: 6 }, { x: 3, y: 1 }, { x: 4, y: 5 }]);
    expect(r.r2).toBeLessThan(0.2);
  });

  test('no calcula con menos de 2 puntos ni con todos en el mismo instante', () => {
    expect(regresionLineal([{ x: 0, y: 1 }])).toBeNull();
    expect(regresionLineal([{ x: 0, y: 1 }, { x: 0, y: 2 }])).toBeNull();
  });
});

describe('CP-23 · predecirExcursion (tendencia de 20 min)', () => {
  test('temperatura subiendo 0,2 °C/min desde 5 °C: saldrá de 8 °C en ~15 min y es aviso preventivo', () => {
    const p = predecir(serie(20, (min) => 5 - 0.2 * min));
    expect(p).toMatchObject({ disponible: true, tendencia: 'subiendo', limite: 'max', confiable: true });
    expect(p.pendiente_c_10min).toBeCloseTo(2);
    expect(p.temperatura_estimada).toBeCloseTo(5);
    expect(p.minutos_para_salir).toBe(15);
    expect(p.preventiva).toBe(true);
  });

  test('si falta más de 15 min para salir hay predicción pero no aviso preventivo', () => {
    const p = predecir(serie(20, (min) => 5 - 0.05 * min)); // 3 °C / 0,05 = 60 min
    expect(p.minutos_para_salir).toBe(60);
    expect(p.minutos_para_salir).toBeGreaterThan(UMBRAL_PREVENTIVO_MIN);
    expect(p.preventiva).toBe(false);
  });

  test('temperatura bajando hacia 2 °C predice el cruce del mínimo', () => {
    const p = predecir(serie(20, (min) => 3 + 0.1 * min)); // baja 0,1 °C/min, está en 3 °C
    expect(p).toMatchObject({ tendencia: 'bajando', limite: 'min', minutos_para_salir: 10, preventiva: true });
  });

  test('temperatura estable: no anuncia salida', () => {
    const p = predecir(serie(20, () => 4.5));
    expect(p).toMatchObject({ disponible: true, tendencia: 'estable', limite: null, minutos_para_salir: null, preventiva: false });
  });

  test('un cruce a más de 2 h no se anuncia (la recta deja de ser confiable)', () => {
    const p = predecir(serie(20, (min) => 4 - 0.02 * min)); // 4 °C / 0,02 = 200 min
    expect(p.tendencia).toBe('subiendo');
    expect(p.minutos_para_salir).toBeNull();
  });

  test('si ya está fuera del rango, minutos_para_salir es 0 y no es «preventiva»', () => {
    const p = predecir(serie(15, (min) => 9 - 0.1 * min));
    expect(p).toMatchObject({ limite: 'max', minutos_para_salir: 0, preventiva: false });
  });

  test('usa el rango configurado de cada refrigeradora (HU11)', () => {
    const p = predecir(serie(20, (min) => 3 - 0.1 * min), { tempMin: 0, tempMax: 4 });
    expect(p).toMatchObject({ limite: 'max', minutos_para_salir: 10 });
  });

  test('con datos muy dispersos (R² bajo) no se da aviso preventivo', () => {
    const ruido = [0, 1.5, -1.2, 1.8, -1.5, 1.1, -0.9, 1.6, -1.4, 1.3, -1.6, 1.2, -1.1, 1.7, -1.3];
    const p = predecir(serie(15, (min) => 5 - 0.02 * min + ruido[min]));
    expect(p.confiable).toBe(false);
    expect(p.minutos_para_salir).toBeNull(); // sin dirección clara no se anuncia un cruce
    expect(p.preventiva).toBe(false);
  });

  test('ignora lecturas con error de sensor y las de hace más de 20 min', () => {
    const lecturas = [
      ...serie(12, (min) => 5 - 0.2 * min),
      { temperatura: null, estado: 'error_sensor', medido_en: hace(3) },
      { temperatura: 30, estado: 'ok', medido_en: hace(45) },
    ];
    const p = predecir(lecturas);
    expect(p.lecturas_usadas).toBe(12);
    expect(p.minutos_para_salir).toBe(15);
  });

  test('lecturas de menos de 10 min no bastan (el ruido parecería tendencia)', () => {
    const p = predecir(serie(8, (min) => 5 - 0.5 * min));
    expect(p.disponible).toBe(false);
    expect(p.motivo).toMatch(/al menos 10 min/);
  });

  test('con menos de 5 lecturas recientes no hay predicción', () => {
    const p = predecir(serie(4, () => 5));
    expect(p.disponible).toBe(false);
    expect(p.motivo).toMatch(/al menos 5 lecturas/);
    expect(predecir([]).disponible).toBe(false);
  });
});

describe('CP-24 · saludSensor (últimas 12 h)', () => {
  const variada = (n) => serie(n, (min) => 4 + (min % 7) * 0.0625);

  test('nodo que envía todas sus lecturas sin errores: riesgo «ok»', () => {
    const s = saludSensor({ lecturas: variada(120), ahora: AHORA });
    expect(s).toMatchObject({ disponible: true, recibidas: 120, errores_pct: 0, congelado: false, riesgo: 'ok', motivos: [] });
    expect(s.perdidas_pct).toBeLessThan(5);
  });

  test('más del 5 % de lecturas con error: «atención»', () => {
    const lecturas = variada(100).map((l, i) => (i % 10 === 0 ? { ...l, temperatura: null, estado: 'error_sensor' } : l));
    const s = saludSensor({ lecturas, ahora: AHORA });
    expect(s.errores_pct).toBe(10);
    expect(s.riesgo).toBe('atencion');
    expect(s.motivos.join()).toMatch(/error de sensor/);
  });

  test('20 % o más de errores: «falla probable»', () => {
    const lecturas = variada(50).map((l, i) => (i % 4 === 0 ? { ...l, temperatura: null, estado: 'error_sensor' } : l));
    expect(saludSensor({ lecturas, ahora: AHORA }).riesgo).toBe('falla_probable');
  });

  test('dos de cada tres lecturas perdidas: «falla probable»', () => {
    const lecturas = variada(120).filter((_, i) => i % 3 === 0);
    const s = saludSensor({ lecturas, ahora: AHORA });
    expect(s.perdidas_pct).toBeGreaterThanOrEqual(60);
    expect(s.riesgo).toBe('falla_probable');
  });

  test('el mismo valor exacto durante 1 h: lectura «congelada»', () => {
    const s = saludSensor({ lecturas: serie(70, () => 4.5), ahora: AHORA });
    expect(s.congelado).toBe(true);
    expect(s.riesgo).toBe('atencion');
  });

  test('una lectura de 85 °C (reinicio del DS18B20) se cuenta como síntoma', () => {
    const lecturas = variada(60);
    lecturas[30] = { ...lecturas[30], temperatura: 85 };
    const s = saludSensor({ lecturas, ahora: AHORA });
    expect(s.reinicios_85).toBe(1);
    expect(s.riesgo).toBe('atencion');
  });

  test('sin lecturas recientes no hay diagnóstico', () => {
    expect(saludSensor({ lecturas: [], ahora: AHORA }).disponible).toBe(false);
    expect(saludSensor({ lecturas: [{ temperatura: 4, estado: 'ok', medido_en: hace(13 * 60) }], ahora: AHORA }).disponible).toBe(false);
  });
});

describe('CP-23 · GET /api/estado incluye la predicción y la salud del sensor', () => {
  const ADMIN = { 'x-rol': 'administrador' };

  test('la refrigeradora trae «prediccion» y «salud_sensor»; sin sensor vienen en null', async () => {
    const repo = crearRepositorioMemoria();
    const app = crearApp(repo);
    const ref = (await request(app).post('/api/refrigeradoras').set(ADMIN).send({ nombre: 'Principal' })).body;
    await request(app).post('/api/refrigeradoras').set(ADMIN).send({ nombre: 'Sin sensor' });
    await request(app).post('/api/sensores').set(ADMIN).send({ codigo: 'S-1', dispositivo_id: 'MF-NODO-01', refrigeradora_id: ref.id });
    const ahora = Date.now();
    for (let min = 19; min >= 0; min--) {
      await repo.registrarLectura({ dispositivo_id: 'MF-NODO-01', temperatura: 6 - 0.15 * min, medido_en: new Date(ahora - min * 60000).toISOString() });
    }

    const res = await request(app).get('/api/estado').set({ 'x-rol': 'tecnico' });
    const principal = res.body.refrigeradoras.find((x) => x.refrigeradora.id === ref.id);
    expect(principal.prediccion).toMatchObject({ disponible: true, tendencia: 'subiendo', limite: 'max', preventiva: true });
    expect(principal.prediccion.minutos_para_salir).toBeGreaterThanOrEqual(13);
    expect(principal.prediccion.minutos_para_salir).toBeLessThanOrEqual(14);
    expect(principal.salud_sensor).toMatchObject({ disponible: true, recibidas: 20, riesgo: 'ok' });
    const sinSensor = res.body.refrigeradoras.find((x) => x.refrigeradora.id !== ref.id);
    expect(sinSensor.prediccion).toBeNull();
    expect(sinSensor.salud_sensor).toBeNull();
  });

  test('lecturasDesde devuelve solo las lecturas del dispositivo desde la fecha, en orden', async () => {
    const repo = crearRepositorioMemoria();
    await repo.registrarLectura({ dispositivo_id: 'A', temperatura: 5, medido_en: hace(5) });
    await repo.registrarLectura({ dispositivo_id: 'A', temperatura: 4, medido_en: hace(20) });
    await repo.registrarLectura({ dispositivo_id: 'A', temperatura: 3, medido_en: hace(90) });
    await repo.registrarLectura({ dispositivo_id: 'B', temperatura: 9, medido_en: hace(5) });
    const l = await repo.lecturasDesde('A', hace(60));
    expect(l.map((x) => x.temperatura)).toEqual([4, 5]);
  });

  test('modo demo: /api/demo/rampa sube la temperatura de forma constante', async () => {
    const repo = crearRepositorioMemoria();
    const app = crearApp(repo);
    const ref = (await request(app).post('/api/refrigeradoras').set(ADMIN).send({ nombre: 'Demo' })).body;
    await request(app).post('/api/sensores').set(ADMIN).send({ codigo: 'S-D', dispositivo_id: 'MF-NODO-01', refrigeradora_id: ref.id });
    const simulador = iniciarSimulador(repo, { intervaloMs: 60000 });
    const appDemo = crearApp(repo, { demo: { simulador } });

    const res = await request(appDemo).post('/api/demo/rampa').send({ dispositivo_id: 'MF-NODO-01', grados_por_min: 0.2 });
    expect(res.body.rampa_c_min).toBe(0.2);
    const t1 = (await repo.ultimaLectura('MF-NODO-01')).temperatura;
    await new Promise((r) => setTimeout(r, 5)); // otra hora de medición (evita la lectura duplicada)
    await simulador.tick();
    const lecturas = await repo.lecturasDesde('MF-NODO-01', new Date(0).toISOString());
    expect(lecturas.at(-1).temperatura).toBeCloseTo(t1 + 0.2, 1);
    expect((await request(appDemo).post('/api/demo/rampa').send({ grados_por_min: 'x' })).status).toBe(400);
    await request(appDemo).post('/api/demo/normal').send({ dispositivo_id: 'MF-NODO-01' });
    expect((await request(appDemo).get('/api/demo/MF-NODO-01')).body.rampa_c_min).toBeUndefined();
    simulador.detener();
  });
});
