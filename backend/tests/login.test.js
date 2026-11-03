// CP-15 (Integración) – Inicio de sesión y rutas protegidas (HU20). Tarea T31 – Kheyla Cóndor
// Se prueba la API completa con un secreto JWT (como el servidor real): el encabezado «x-rol» ya no sirve.
const request = require('supertest');
const { crearApp } = require('../src/app');
const { crearRepositorioMemoria } = require('../src/db/repositorioMemoria');
const { hashear } = require('../src/auth/contrasenas');
const { emitirToken } = require('../src/auth/tokens');

const SECRETO = 'secreto-de-prueba-con-mas-de-32-caracteres';
const T0 = new Date('2026-10-20T15:00:00Z').getTime();
let ahora; let repo; let app;

beforeEach(async () => {
  ahora = new Date(T0);
  repo = crearRepositorioMemoria();
  app = crearApp(repo, { jwtSecreto: SECRETO, reloj: () => ahora });
  const hash = await hashear('Clave2026!');
  await repo.crearUsuario({ correo: 'admin@botica.pe', nombre: 'Admin', rol: 'administrador', hash_contrasena: hash });
  await repo.crearUsuario({ correo: 'tecnico@botica.pe', nombre: 'Luis', rol: 'tecnico', hash_contrasena: hash });
});

const login = (correo, contrasena) => request(app).post('/api/auth/login').send({ correo, contrasena });
const conToken = (token) => ({ Authorization: `Bearer ${token}` });

describe('CP-15 · Login (HU20-1)', () => {
  test('con correo y contraseña correctos devuelve un token y los datos del usuario (sin el hash)', async () => {
    const res = await login('ADMIN@botica.pe ', 'Clave2026!'); // ignora mayúsculas y espacios del correo
    expect(res.status).toBe(200);
    expect(res.body.token.split('.')).toHaveLength(3);
    expect(res.body.usuario).toEqual({ id: expect.any(String), nombre: 'Admin', correo: 'admin@botica.pe', rol: 'administrador' });
    expect(JSON.stringify(res.body)).not.toContain('hash');
    expect(res.body.expira_en).toBe('2026-10-20T23:00:00.000Z');
  });

  test('una contraseña incorrecta o un correo inexistente dan el mismo mensaje (no revela qué correos existen)', async () => {
    const mala = await login('admin@botica.pe', 'otra');
    const noExiste = await login('nadie@botica.pe', 'otra');
    expect(mala.status).toBe(401);
    expect(noExiste.status).toBe(401);
    expect(mala.body.errores[0]).toMatch(/^Correo o contraseña incorrectos/);
    expect(noExiste.body.errores[0]).toBe('Correo o contraseña incorrectos.');
  });

  test('pide correo y contraseña', async () => {
    expect((await login('', '')).status).toBe(400);
  });
});

describe('CP-15 · Rutas protegidas con y sin token (HU20)', () => {
  test('sin token → 401; con token → 200; el encabezado x-rol ya no da acceso', async () => {
    expect((await request(app).get('/api/estado')).status).toBe(401);
    expect((await request(app).get('/api/estado').set('x-rol', 'administrador')).status).toBe(401);
    const { body } = await login('admin@botica.pe', 'Clave2026!');
    expect((await request(app).get('/api/estado').set(conToken(body.token))).status).toBe(200);
    expect((await request(app).get('/api/auth/yo').set(conToken(body.token))).body).toMatchObject({ nombre: 'Admin', rol: 'administrador' });
  });

  test('todas las rutas de datos están protegidas; /api/salud y el login son públicos', async () => {
    for (const ruta of ['/api/refrigeradoras', '/api/sensores', '/api/estado', '/api/alertas', '/api/auth/yo']) {
      expect((await request(app).get(ruta)).status).toBe(401);
    }
    expect((await request(app).get('/api/salud')).status).toBe(200);
  });

  test('el token vence a las 8 h: después responde 401 «Tu sesión expiró»', async () => {
    const { body } = await login('admin@botica.pe', 'Clave2026!');
    ahora = new Date(T0 + 8 * 3600000 + 1000);
    const res = await request(app).get('/api/estado').set(conToken(body.token));
    expect(res.status).toBe(401);
    expect(res.body.errores[0]).toMatch(/expiró/);
  });

  test('un token falsificado (firmado con otro secreto) no sirve', async () => {
    const falso = emitirToken({ id: 'x', rol: 'administrador', nombre: 'Intruso' }, { secreto: 'otro-secreto-cualquiera-de-32-caracteres!' });
    const res = await request(app).get('/api/estado').set(conToken(falso));
    expect(res.status).toBe(401);
    expect(res.body.errores[0]).toMatch(/no es válida/);
  });

  test('el rol viene del token: el técnico no puede crear refrigeradoras (403) y el administrador sí (201)', async () => {
    const tecnico = (await login('tecnico@botica.pe', 'Clave2026!')).body.token;
    const admin = (await login('admin@botica.pe', 'Clave2026!')).body.token;
    expect((await request(app).post('/api/refrigeradoras').set(conToken(tecnico)).send({ nombre: 'X' })).status).toBe(403);
    expect((await request(app).post('/api/refrigeradoras').set(conToken(admin)).send({ nombre: 'X' })).status).toBe(201);
  });
});

describe('CP-15 · Bloqueo tras 5 intentos fallidos (HU20-2)', () => {
  test('al 5.º intento fallido se bloquea; ni la contraseña correcta entra durante 5 min; después sí', async () => {
    for (let i = 1; i <= 4; i += 1) {
      const r = await login('tecnico@botica.pe', 'mala');
      expect(r.status).toBe(401);
      expect(r.body.errores[0]).toContain(`Te quedan ${5 - i}`);
    }
    const quinto = await login('tecnico@botica.pe', 'mala');
    expect(quinto.status).toBe(423);
    expect(quinto.body.bloqueado_hasta).toBe('2026-10-20T15:05:00.000Z');

    ahora = new Date(T0 + 4 * 60000);
    const bloqueado = await login('tecnico@botica.pe', 'Clave2026!');
    expect(bloqueado.status).toBe(423);
    expect(bloqueado.body.errores[0]).toMatch(/1 min/);

    ahora = new Date(T0 + 5 * 60000 + 1000);
    expect((await login('tecnico@botica.pe', 'Clave2026!')).status).toBe(200);
    expect((await repo.buscarUsuarioPorCorreo('tecnico@botica.pe')).intentos_fallidos).toBe(0);
  });

  test('el bloqueo de un usuario no afecta a los demás', async () => {
    for (let i = 0; i < 5; i += 1) await login('tecnico@botica.pe', 'mala');
    expect((await login('admin@botica.pe', 'Clave2026!')).status).toBe(200);
  });

  test('una cuenta desactivada no puede entrar', async () => {
    const u = await repo.buscarUsuarioPorCorreo('tecnico@botica.pe');
    await repo.actualizarUsuario(u.id, { activo: false });
    expect((await login('tecnico@botica.pe', 'Clave2026!')).status).toBe(403);
  });
});
