// CP-12 (Unitaria e integración de la API) – HU06: estado de cada refrigeradora en el dashboard.
// Tarea T11 – Kheyla Cóndor (las pruebas corren en GitHub Actions)
const request = require('supertest');
const { crearApp } = require('../src/app');
const { crearRepositorioMemoria } = require('../src/db/repositorioMemoria');
const { calcularEstado, MINUTOS_SIN_SENAL } = require('../src/validacion/estado');
const { iniciarSimulador } = require('../src/demo/simuladorLecturas');

const REFRI = { temp_min: 2, temp_max: 8 };
const SENSOR = { dispositivo_id: 'MF-NODO-01' };
const AHORA = new Date('2026-10-12T15:00:00Z');
const hace = (min) => new Date(AHORA.getTime() - min * 60000).toISOString();

describe('CP-12 · calcularEstado (HU06)', () => {
  test('temperatura dentro de 2–8 °C es «normal» (verde)', () => {
    const r = calcularEstado({ refrigeradora: REFRI, sensor: SENSOR, lectura: { temperatura: 4.5, estado: 'ok', medido_en: hace(1) }, ahora: AHORA });
    expect(r.estado).toBe('normal');
    expect(r.minutos_desde_lectura).toBe(1);
  });

  test('los límites 2 °C y 8 °C todavía son normales', () => {
    for (const t of [2, 8]) {
      expect(calcularEstado({ refrigeradora: REFRI, sensor: SENSOR, lectura: { temperatura: t, estado: 'ok', medido_en: hace(0) }, ahora: AHORA }).estado).toBe('normal');
    }
  });

  test('por encima del máximo es «alerta» (rojo)', () => {
    const r = calcularEstado({ refrigeradora: REFRI, sensor: SENSOR, lectura: { temperatura: 9.3, estado: 'ok', medido_en: hace(0) }, ahora: AHORA });
    expect(r).toMatchObject({ estado: 'alerta' });
    expect(r.motivo).toMatch(/máximo/);
  });

  test('por debajo del mínimo es «alerta»', () => {
    const r = calcularEstado({ refrigeradora: REFRI, sensor: SENSOR, lectura: { temperatura: 1.2, estado: 'ok', medido_en: hace(0) }, ahora: AHORA });
    expect(r.estado).toBe('alerta');
    expect(r.motivo).toMatch(/mínimo/);
  });

  test('una lectura «error_sensor» es alerta', () => {
    const r = calcularEstado({ refrigeradora: REFRI, sensor: SENSOR, lectura: { temperatura: null, estado: 'error_sensor', medido_en: hace(0) }, ahora: AHORA });
    expect(r.estado).toBe('alerta');
    expect(r.motivo).toMatch(/sensor/i);
  });

  test(`sin datos hace ${MINUTOS_SIN_SENAL} min o más es «sin señal» (gris)`, () => {
    const r = calcularEstado({ refrigeradora: REFRI, sensor: SENSOR, lectura: { temperatura: 4, estado: 'ok', medido_en: hace(MINUTOS_SIN_SENAL) }, ahora: AHORA });
    expect(r.estado).toBe('sin_senal');
    expect(calcularEstado({ refrigeradora: REFRI, sensor: SENSOR, lectura: { temperatura: 4, estado: 'ok', medido_en: hace(9) }, ahora: AHORA }).estado).toBe('normal');
  });

  test('sin lecturas todavía es «sin señal» y sin sensor es «sin_sensor»', () => {
    expect(calcularEstado({ refrigeradora: REFRI, sensor: SENSOR, lectura: null, ahora: AHORA }).estado).toBe('sin_senal');
    expect(calcularEstado({ refrigeradora: REFRI, sensor: null, lectura: null, ahora: AHORA }).estado).toBe('sin_sensor');
  });

  test('usa el rango configurado de cada refrigeradora (HU11)', () => {
    const r = calcularEstado({ refrigeradora: { temp_min: 0, temp_max: 4 }, sensor: SENSOR, lectura: { temperatura: 5, estado: 'ok', medido_en: hace(0) }, ahora: AHORA });
    expect(r.estado).toBe('alerta');
  });
});

describe('CP-12 · GET /api/estado (HU06)', () => {
  let repo;
  let app;
  const ADMIN = { 'x-rol': 'administrador' };

  beforeEach(() => {
    repo = crearRepositorioMemoria();
    app = crearApp(repo);
  });

  async function refriConSensor(nombre, dispositivo) {
    const ref = (await request(app).post('/api/refrigeradoras').set(ADMIN).send({ nombre })).body;
    await request(app).post('/api/sensores').set(ADMIN).send({ codigo: `S-${dispositivo}`, dispositivo_id: dispositivo, refrigeradora_id: ref.id });
    return ref;
  }

  test('devuelve cada refrigeradora activa con su última lectura y estado', async () => {
    await refriConSensor('Refrigeradora principal', 'MF-NODO-01');
    await repo.registrarLectura({ dispositivo_id: 'MF-NODO-01', temperatura: 5.1, medido_en: new Date(Date.now() - 120000).toISOString() });
    await repo.registrarLectura({ dispositivo_id: 'MF-NODO-01', temperatura: 4.4, medido_en: new Date().toISOString() });

    const res = await request(app).get('/api/estado').set({ 'x-rol': 'tecnico' }); // el técnico también puede ver
    expect(res.status).toBe(200);
    expect(res.body.actualizado_en).toBeDefined();
    expect(res.body.refrigeradoras).toHaveLength(1);
    expect(res.body.refrigeradoras[0]).toMatchObject({
      refrigeradora: { nombre: 'Refrigeradora principal', temp_min: 2, temp_max: 8 },
      sensor: { dispositivo_id: 'MF-NODO-01' },
      lectura: { temperatura: 4.4, estado: 'ok' },
      estado: 'normal',
    });
  });

  test('una refrigeradora sin sensor aparece como «sin_sensor» y una desactivada no aparece', async () => {
    const r1 = (await request(app).post('/api/refrigeradoras').set(ADMIN).send({ nombre: 'Sin sensor' })).body;
    const r2 = (await request(app).post('/api/refrigeradoras').set(ADMIN).send({ nombre: 'Vieja' })).body;
    await request(app).put(`/api/refrigeradoras/${r2.id}`).set(ADMIN).send({ activa: false });
    const res = await request(app).get('/api/estado');
    expect(res.body.refrigeradoras.map((x) => x.refrigeradora.id)).toEqual([r1.id]);
    expect(res.body.refrigeradoras[0].estado).toBe('sin_sensor');
  });

  test('GET /api/estado/:id devuelve una refrigeradora y 404 si no existe', async () => {
    const ref = await refriConSensor('Refri 2', 'MF-NODO-02');
    await repo.registrarLectura({ dispositivo_id: 'MF-NODO-02', temperatura: 9.5 });
    const ok = await request(app).get(`/api/estado/${ref.id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.estado).toBe('alerta');
    const no = await request(app).get('/api/estado/00000000-0000-0000-0000-000000000000');
    expect(no.status).toBe(404);
  });

  test('el repositorio en memoria rechaza una lectura duplicada (mismo dispositivo y hora)', async () => {
    const medido_en = new Date().toISOString();
    await repo.registrarLectura({ dispositivo_id: 'MF-NODO-01', temperatura: 4, medido_en });
    await expect(repo.registrarLectura({ dispositivo_id: 'MF-NODO-01', temperatura: 4, medido_en })).rejects.toThrow('ya fue registrada');
  });

  test('el simulador del modo demo genera lecturas entre 2,5 y 7,5 °C para cada sensor vinculado', async () => {
    await refriConSensor('Demo', 'MF-NODO-09');
    const sim = iniciarSimulador(repo, { intervaloMs: 60000 });
    await sim.tick();
    sim.detener();
    const l = await repo.ultimaLectura('MF-NODO-09');
    expect(l.temperatura).toBeGreaterThanOrEqual(2.5);
    expect(l.temperatura).toBeLessThanOrEqual(7.5);
  });
});
