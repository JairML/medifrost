// CP-32 (Integración de la API) y CP-17 (API) – HU21 y HU11. Tareas T15 y T18 – Kheyla Cóndor
// Se prueba la API completa con el repositorio en memoria (no necesita Supabase).
const request = require('supertest');
const { crearApp } = require('../src/app');
const { crearRepositorioMemoria } = require('../src/db/repositorioMemoria');

const ADMIN = { 'x-rol': 'administrador' };
const DT = { 'x-rol': 'directora_tecnica' };
const TECNICO = { 'x-rol': 'tecnico' };

let app;
beforeEach(() => { app = crearApp(crearRepositorioMemoria()); });

async function crearRefri(nombre = 'Refrigeradora principal') {
  const res = await request(app).post('/api/refrigeradoras').set(ADMIN).send({ nombre, ubicacion: 'Mostrador' });
  return res.body;
}

describe('API de salud', () => {
  test('GET /api/salud responde ok', async () => {
    const res = await request(app).get('/api/salud');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ok');
  });
});

describe('CP-32 · Refrigeradoras (HU21)', () => {
  test('el administrador crea una refrigeradora con la configuración por defecto 2–8 °C / 15 min', async () => {
    const res = await request(app).post('/api/refrigeradoras').set(ADMIN).send({ nombre: 'Refri 1' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ nombre: 'Refri 1', temp_min: 2, temp_max: 8, tolerancia_min: 15, activa: true });
  });

  test('un técnico no puede crear refrigeradoras', async () => {
    const res = await request(app).post('/api/refrigeradoras').set(TECNICO).send({ nombre: 'Refri 1' });
    expect(res.status).toBe(403);
  });

  test('rechaza una refrigeradora sin nombre', async () => {
    const res = await request(app).post('/api/refrigeradoras').set(ADMIN).send({ nombre: '' });
    expect(res.status).toBe(400);
  });

  test('edita y desactiva una refrigeradora', async () => {
    const ref = await crearRefri();
    const res = await request(app).put(`/api/refrigeradoras/${ref.id}`).set(ADMIN).send({ nombre: 'Refri vacunas', activa: false });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ nombre: 'Refri vacunas', activa: false });
  });

  test('editar una refrigeradora que no existe devuelve 404', async () => {
    const res = await request(app).put('/api/refrigeradoras/no-existe').set(ADMIN).send({ nombre: 'X' });
    expect(res.status).toBe(404);
  });

  test('la lista incluye el sensor vinculado y el estado de su calibración', async () => {
    const ref = await crearRefri();
    await request(app).post('/api/sensores').set(ADMIN)
      .send({ codigo: 'DS18B20-001', dispositivo_id: 'MF-NODO-01', refrigeradora_id: ref.id, vence_calibracion: '2020-01-01' });
    const res = await request(app).get('/api/refrigeradoras');
    expect(res.status).toBe(200);
    expect(res.body[0].sensor.codigo).toBe('DS18B20-001');
    expect(res.body[0].estado_calibracion).toBe('vencida');
  });
});

describe('CP-32 · Sensores (HU21)', () => {
  test('registra un sensor con su certificado de calibración', async () => {
    const ref = await crearRefri();
    const res = await request(app).post('/api/sensores').set(ADMIN).send({
      codigo: 'DS18B20-001', dispositivo_id: 'MF-NODO-01', refrigeradora_id: ref.id,
      fecha_calibracion: '2026-09-01', vence_calibracion: '2030-09-01', nro_certificado: 'LAB-123',
    });
    expect(res.status).toBe(201);
    expect(res.body.estado_calibracion).toBe('vigente');
  });

  test('no permite vincular el mismo dispositivo dos veces (criterio HU21-2)', async () => {
    const ref1 = await crearRefri('Refri 1');
    const ref2 = await crearRefri('Refri 2');
    await request(app).post('/api/sensores').set(ADMIN).send({ codigo: 'S-1', dispositivo_id: 'MF-NODO-01', refrigeradora_id: ref1.id });
    const res = await request(app).post('/api/sensores').set(ADMIN).send({ codigo: 'S-2', dispositivo_id: 'MF-NODO-01', refrigeradora_id: ref2.id });
    expect(res.status).toBe(409);
    expect(res.body.errores[0]).toBe('Ese dispositivo ya está registrado.');
  });

  test('no permite dos sensores en la misma refrigeradora', async () => {
    const ref = await crearRefri();
    await request(app).post('/api/sensores').set(ADMIN).send({ codigo: 'S-1', dispositivo_id: 'MF-NODO-01', refrigeradora_id: ref.id });
    const res = await request(app).post('/api/sensores').set(ADMIN).send({ codigo: 'S-2', dispositivo_id: 'MF-NODO-02', refrigeradora_id: ref.id });
    expect(res.status).toBe(409);
  });

  test('rechaza un vencimiento anterior a la calibración', async () => {
    const res = await request(app).post('/api/sensores').set(ADMIN)
      .send({ codigo: 'S-1', dispositivo_id: 'MF-NODO-01', fecha_calibracion: '2026-09-01', vence_calibracion: '2026-01-01' });
    expect(res.status).toBe(400);
  });

  test('vincular a una refrigeradora inexistente devuelve 404', async () => {
    const res = await request(app).post('/api/sensores').set(ADMIN)
      .send({ codigo: 'S-1', dispositivo_id: 'MF-NODO-01', refrigeradora_id: 'no-existe' });
    expect(res.status).toBe(404);
  });

  test('actualiza los datos de calibración de un sensor', async () => {
    const ref = await crearRefri();
    const creado = await request(app).post('/api/sensores').set(ADMIN).send({ codigo: 'S-1', dispositivo_id: 'MF-NODO-01', refrigeradora_id: ref.id });
    const res = await request(app).put(`/api/sensores/${creado.body.id}`).set(ADMIN)
      .send({ codigo: 'S-1', dispositivo_id: 'MF-NODO-01', refrigeradora_id: ref.id, vence_calibracion: '2030-01-01' });
    expect(res.status).toBe(200);
    expect(res.body.vence_calibracion).toBe('2030-01-01');
  });
});

describe('CP-17 · Configuración de rango y tolerancia (HU11)', () => {
  test('la Directora Técnica guarda un rango y una tolerancia válidos', async () => {
    const ref = await crearRefri();
    const res = await request(app).put(`/api/refrigeradoras/${ref.id}/configuracion`).set(DT)
      .send({ temp_min: 2.5, temp_max: 7.5, tolerancia_min: 20 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ temp_min: 2.5, temp_max: 7.5, tolerancia_min: 20 });
    const leida = await request(app).get(`/api/refrigeradoras/${ref.id}/configuracion`);
    expect(leida.body).toEqual({ temp_min: 2.5, temp_max: 7.5, tolerancia_min: 20 });
  });

  test('un técnico no puede cambiar la configuración (criterio HU11-1)', async () => {
    const ref = await crearRefri();
    const res = await request(app).put(`/api/refrigeradoras/${ref.id}/configuracion`).set(TECNICO)
      .send({ temp_min: 2, temp_max: 8, tolerancia_min: 15 });
    expect(res.status).toBe(403);
  });

  test('rechaza mínimo ≥ máximo y no cambia la configuración (criterio HU11-2)', async () => {
    const ref = await crearRefri();
    const res = await request(app).put(`/api/refrigeradoras/${ref.id}/configuracion`).set(DT)
      .send({ temp_min: 8, temp_max: 2, tolerancia_min: 15 });
    expect(res.status).toBe(400);
    const leida = await request(app).get(`/api/refrigeradoras/${ref.id}/configuracion`);
    expect(leida.body).toEqual({ temp_min: 2, temp_max: 8, tolerancia_min: 15 });
  });

  test('rechaza una tolerancia de 90 minutos', async () => {
    const ref = await crearRefri();
    const res = await request(app).put(`/api/refrigeradoras/${ref.id}/configuracion`).set(DT)
      .send({ temp_min: 2, temp_max: 8, tolerancia_min: 90 });
    expect(res.status).toBe(400);
  });

  test('configurar una refrigeradora inexistente devuelve 404', async () => {
    const res = await request(app).put('/api/refrigeradoras/no-existe/configuracion').set(DT)
      .send({ temp_min: 2, temp_max: 8, tolerancia_min: 15 });
    expect(res.status).toBe(404);
  });

  test('un JSON mal formado devuelve 400', async () => {
    const ref = await crearRefri();
    const res = await request(app).put(`/api/refrigeradoras/${ref.id}/configuracion`).set(DT)
      .set('Content-Type', 'application/json').send('{temp_min: 2');
    expect(res.status).toBe(400);
  });
});
