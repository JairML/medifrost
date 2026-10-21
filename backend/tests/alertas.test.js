// CP-16 (Integración) – Vigilante de alertas y API /api/alertas (HU12, HU13, HU04). Tareas T19 y T23 – Jair Menéndez.
// Se usa un reloj simulado para «adelantar el tiempo» sin esperar 15 minutos de verdad.
const request = require('supertest');
const { crearApp } = require('../src/app');
const { crearRepositorioMemoria } = require('../src/db/repositorioMemoria');
const { crearVigilante } = require('../src/alertas/vigilante');
const { crearNotificadorConsola } = require('../src/alertas/correo');
const { iniciarSimulador } = require('../src/demo/simuladorLecturas');

const ADMIN = { 'x-rol': 'administrador' };
const T0 = new Date('2026-10-20T15:00:00Z').getTime();
const min = (m) => new Date(T0 + m * 60000);
const silencio = { info: () => {}, error: () => {} };

let repo; let notificador; let ahora; let vigilante; let app; let refri;

async function lectura(m, temperatura, extra = {}) {
  await repo.registrarLectura({ dispositivo_id: 'MF-NODO-01', temperatura, medido_en: min(m).toISOString(), ...extra });
}
async function cicloEn(m) { ahora = min(m); return vigilante.revisar(); }
const asuntos = () => notificador.enviados.map((c) => c.asunto);

beforeEach(async () => {
  repo = crearRepositorioMemoria();
  notificador = crearNotificadorConsola({ log: () => {} });
  ahora = min(0);
  vigilante = crearVigilante({ repo, notificador, reloj: () => ahora, log: silencio, urlDashboard: 'http://localhost:5173' });
  app = crearApp(repo, { reloj: () => ahora });
  refri = await repo.crearRefrigeradora({ nombre: 'Refrigeradora principal' });
  await repo.crearSensor({ codigo: 'DS18B20-001', dispositivo_id: 'MF-NODO-01', refrigeradora_id: refri.id });
});

describe('CP-16 · Vigilante: temperatura (HU12)', () => {
  test('excursión completa: espera la tolerancia, avisa, repite a los 30 min, se atiende y avisa la normalización', async () => {
    await lectura(0, 9.2); await cicloEn(0);
    expect(notificador.enviados).toHaveLength(0); // dentro de la tolerancia (15 min): todavía no avisa

    await lectura(15, 9.6); await cicloEn(15);
    expect(asuntos()).toHaveLength(1);
    expect(asuntos()[0]).toMatch(/fuera de rango – 9.6 °C/);

    await lectura(44, 9.8); await cicloEn(44);
    expect(asuntos()).toHaveLength(1); // aún no pasan 30 min desde el aviso
    await lectura(45, 9.9); await cicloEn(45);
    expect(asuntos()).toHaveLength(2);
    expect(asuntos()[1]).toMatch(/aviso 2/);

    const [abierta] = await repo.alertasAbiertas(refri.id);
    const res = await request(app).post(`/api/alertas/${abierta.id}/atender`).set({ 'x-rol': 'directora_tecnica' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'atendida', atendida_por: 'Directora Técnica' });

    await lectura(80, 9.5); await cicloEn(80);
    expect(asuntos()).toHaveLength(2); // atendida: ya no se repite

    await lectura(81, 5.0); await cicloEn(81);
    expect(asuntos()).toHaveLength(3);
    expect(asuntos()[2]).toMatch(/volvió al rango/);
    expect(notificador.enviados[2].texto).toContain('81 min');
    expect(await repo.alertasAbiertas(refri.id)).toHaveLength(0);
  });

  test('si vuelve al rango antes de la tolerancia no se envía ningún correo (sin falsas alarmas)', async () => {
    await lectura(0, 8.6); await cicloEn(0);
    await lectura(5, 7.4); await cicloEn(5);
    expect(notificador.enviados).toHaveLength(0);
    const historial = await repo.listarAlertas();
    expect(historial[0].estado).toBe('descartada');
  });

  test('usa la tolerancia configurada en la refrigeradora (HU11)', async () => {
    await repo.actualizarRefrigeradora(refri.id, { tolerancia_min: 5 });
    await lectura(0, 1.2); await cicloEn(0);
    await lectura(5, 1.0); await cicloEn(5);
    expect(asuntos()[0]).toMatch(/fuera de rango – 1.0 °C/);
    expect(notificador.enviados[0].texto).toContain('Mínima alcanzada: 1.0 °C');
  });

  test('si Gmail falla no se pierde la alerta: se reintenta en el siguiente ciclo', async () => {
    const falla = { tipo: 'correo', enviar: jest.fn().mockRejectedValueOnce(new Error('Gmail caído')).mockResolvedValue({ enviado: true }) };
    vigilante = crearVigilante({ repo, notificador: falla, reloj: () => ahora, log: silencio });
    await lectura(0, 9.2); await cicloEn(0);
    await lectura(15, 9.2);
    expect(await cicloEn(15)).toBe(1); // 1 error en el ciclo
    expect((await repo.alertasAbiertas(refri.id))[0].estado).toBe('pendiente');
    await lectura(16, 9.2);
    expect(await cicloEn(16)).toBe(0);
    expect((await repo.alertasAbiertas(refri.id))[0].estado).toBe('activa');
    expect(falla.enviar).toHaveBeenCalledTimes(2);
  });
});

describe('CP-16 · Vigilante: sin señal (HU13)', () => {
  test('a los 10 min sin datos avisa «sin señal», y cuando vuelven los datos avisa que se recuperó', async () => {
    await lectura(0, 4.5); await cicloEn(9);
    expect(notificador.enviados).toHaveLength(0);
    await cicloEn(10);
    expect(asuntos()).toEqual([expect.stringMatching(/sin señal/)]);
    await cicloEn(11);
    expect(asuntos()).toHaveLength(1); // no se repite cada minuto
    await lectura(25, 4.7); await cicloEn(25);
    expect(asuntos()[1]).toMatch(/volvió a enviar datos/);
  });

  test('un nodo que nunca envió datos no genera alerta', async () => {
    await cicloEn(60);
    expect(notificador.enviados).toHaveLength(0);
  });
});

describe('CP-16 · Vigilante: eventos de energía (HU04)', () => {
  test('corte de energía → correo; batería baja → correo; energía restaurada → correo y cierra ambas', async () => {
    await lectura(0, 4.5);
    await repo.registrarEvento({ dispositivo_id: 'MF-NODO-01', tipo: 'corte_energia', bateria_pct: 90, ocurrido_en: min(0).toISOString() });
    await cicloEn(0);
    await repo.registrarEvento({ dispositivo_id: 'MF-NODO-01', tipo: 'bateria_baja', bateria_pct: 18, ocurrido_en: min(5).toISOString() });
    await lectura(5, 4.6); await cicloEn(5);
    await repo.registrarEvento({ dispositivo_id: 'MF-NODO-01', tipo: 'energia_restaurada', bateria_pct: 18, ocurrido_en: min(9).toISOString() });
    await lectura(9, 4.6); await cicloEn(9);
    expect(asuntos()).toEqual([
      expect.stringMatching(/corte de energía/), expect.stringMatching(/batería baja/), expect.stringMatching(/volvió la energía/),
    ]);
    expect(await repo.alertasAbiertas(refri.id)).toHaveLength(0);
    expect(await repo.eventosPendientes()).toHaveLength(0);
  });

  test('los eventos de un dispositivo no vinculado se marcan como procesados sin enviar nada', async () => {
    await repo.registrarEvento({ dispositivo_id: 'OTRO', tipo: 'corte_energia' });
    await cicloEn(0);
    expect(notificador.enviados).toHaveLength(0);
    expect(await repo.eventosPendientes()).toHaveLength(0);
  });
});

describe('CP-16 · API de alertas y estado', () => {
  async function alertaActiva() {
    await lectura(0, 9.2); await cicloEn(0);
    await lectura(15, 9.4); await cicloEn(15);
    return (await repo.alertasAbiertas(refri.id))[0];
  }

  test('GET /api/estado incluye la alerta activa de cada refrigeradora', async () => {
    const a = await alertaActiva();
    const res = await request(app).get('/api/estado');
    expect(res.body.refrigeradoras[0].alertas).toEqual([expect.objectContaining({ id: a.id, tipo: 'temperatura', estado: 'activa', envios: 1, valor_extremo: 9.4 })]);
  });

  test('GET /api/alertas devuelve el historial con el nombre de la refrigeradora; ?abiertas=1 solo las abiertas', async () => {
    await alertaActiva();
    const res = await request(app).get('/api/alertas');
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ tipo: 'temperatura', refrigeradora_nombre: 'Refrigeradora principal' });
    expect((await request(app).get('/api/alertas?abiertas=1')).body).toHaveLength(1);
    expect((await request(app).get('/api/alertas?refrigeradora_id=abc')).status).toBe(400);
  });

  test('no se puede atender dos veces, ni una alerta que no existe', async () => {
    const a = await alertaActiva();
    await request(app).post(`/api/alertas/${a.id}/atender`).set(ADMIN);
    const otra = await request(app).post(`/api/alertas/${a.id}/atender`).set(ADMIN);
    expect(otra.status).toBe(409);
    expect(otra.body.errores[0]).toMatch(/ya fue atendida por Administrador/);
    expect((await request(app).post('/api/alertas/00000000-0000-0000-0000-000000000000/atender')).status).toBe(404);
    expect((await request(app).post('/api/alertas/xyz/atender')).status).toBe(404);
  });

  test('una alerta pendiente (sin correo todavía) no aparece en el dashboard ni se puede atender', async () => {
    await lectura(0, 9.2); await cicloEn(0);
    const [pendiente] = await repo.alertasAbiertas(refri.id);
    expect((await request(app).get('/api/estado')).body.refrigeradoras[0].alertas).toEqual([]);
    expect((await request(app).post(`/api/alertas/${pendiente.id}/atender`)).status).toBe(409);
  });
});

describe('CP-16 · Modo demo (/api/demo)', () => {
  test('fijar 9.5 °C, pausar el nodo y simular un corte, sin hardware', async () => {
    const simulador = iniciarSimulador(repo, { intervaloMs: 60000 });
    const v = crearVigilante({ repo, notificador, log: silencio });
    const appDemo = crearApp(repo, { demo: { simulador, vigilante: v } });

    expect((await request(appDemo).post('/api/demo/temperatura').send({ dispositivo_id: 'MF-NODO-01', temperatura: 9.5 })).body.fijada).toBe(9.5);
    expect((await repo.ultimaLectura('MF-NODO-01')).temperatura).toBe(9.5);
    expect((await request(appDemo).post('/api/demo/temperatura').send({ temperatura: 'abc' })).status).toBe(400);

    expect((await request(appDemo).post('/api/demo/pausar').send({ dispositivo_id: 'MF-NODO-01' })).body.pausado).toBe(true);
    expect((await request(appDemo).post('/api/demo/reanudar').send({ dispositivo_id: 'MF-NODO-01' })).body.pausado).toBe(false);

    await request(appDemo).post('/api/demo/evento').send({ dispositivo_id: 'MF-NODO-01', tipo: 'corte_energia', bateria_pct: 80 });
    expect(asuntos()).toContainEqual(expect.stringMatching(/corte de energía/));
    expect((await repo.ultimaLectura('MF-NODO-01')).alimentacion).toBe('bateria');
    expect((await request(appDemo).post('/api/demo/evento').send({ tipo: 'otro' })).status).toBe(400);

    await request(appDemo).post('/api/demo/normal').send({ dispositivo_id: 'MF-NODO-01' });
    expect((await request(appDemo).get('/api/demo/MF-NODO-01')).body.fijada).toBeUndefined();
    simulador.detener();
  });

  test('sin modo demo las rutas /api/demo no existen', async () => {
    expect((await request(app).post('/api/demo/temperatura').send({ temperatura: 9 })).status).toBe(404);
  });
});
