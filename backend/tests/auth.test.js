// CP-17 (Unitaria) – Contraseñas, tokens y bloqueo del login (HU20). Tarea T29 – Domenico Chang.
const { hashear, verificar, validarContrasena } = require('../src/auth/contrasenas');
const { emitirToken, verificarToken } = require('../src/auth/tokens');
const bloqueo = require('../src/auth/bloqueo');

const SECRETO = 'secreto-de-prueba-con-mas-de-32-caracteres';
const AHORA = new Date('2026-10-20T15:00:00Z');
const usuario = { id: 'u-1', correo: 'dt@botica.pe', nombre: 'Ana', rol: 'directora_tecnica' };

describe('CP-17 · Contraseñas con bcrypt (HU20-1)', () => {
  test('el hash no contiene la contraseña y es de tipo bcrypt', async () => {
    const hash = await hashear('Clave2026!');
    expect(hash).toMatch(/^\$2[aby]\$10\$/);
    expect(hash).not.toContain('Clave2026!');
  });

  test('verifica la contraseña correcta y rechaza la incorrecta', async () => {
    const hash = await hashear('Clave2026!');
    expect(await verificar('Clave2026!', hash)).toBe(true);
    expect(await verificar('clave2026!', hash)).toBe(false);
    expect(await verificar(undefined, hash)).toBe(false);
  });

  test('la misma contraseña genera hashes distintos (sal aleatoria)', async () => {
    expect(await hashear('Clave2026!')).not.toBe(await hashear('Clave2026!'));
  });

  test('exige al menos 8 caracteres y como máximo 72', () => {
    expect(validarContrasena('1234567').valido).toBe(false);
    expect(validarContrasena('12345678').valido).toBe(true);
    expect(validarContrasena('x'.repeat(73)).valido).toBe(false);
    expect(validarContrasena(undefined).valido).toBe(false);
  });
});

describe('CP-17 · Token JWT con expiración (HU20-1)', () => {
  test('el token lleva el id, el rol y el nombre del usuario', () => {
    const token = emitirToken(usuario, { secreto: SECRETO, ahora: AHORA });
    const r = verificarToken(token, { secreto: SECRETO, ahora: AHORA });
    expect(r.usuario).toEqual({ id: 'u-1', rol: 'directora_tecnica', nombre: 'Ana', correo: 'dt@botica.pe' });
    expect(r.expira.toISOString()).toBe('2026-10-20T23:00:00.000Z'); // 8 h por defecto
  });

  test('vence: a las 8 h ya no es válido', () => {
    const token = emitirToken(usuario, { secreto: SECRETO, ahora: AHORA });
    expect(verificarToken(token, { secreto: SECRETO, ahora: new Date(AHORA.getTime() + 7.9 * 3600000) }).usuario).toBeDefined();
    expect(verificarToken(token, { secreto: SECRETO, ahora: new Date(AHORA.getTime() + 8 * 3600000 + 1000) })).toEqual({ error: 'expirado' });
  });

  test('un token firmado con otro secreto o alterado es inválido', () => {
    const token = emitirToken(usuario, { secreto: SECRETO, ahora: AHORA });
    expect(verificarToken(token, { secreto: 'otro-secreto-distinto-de-32-caracteres!!', ahora: AHORA })).toEqual({ error: 'invalido' });
    const alterado = token.slice(0, -2) + (token.endsWith('AA') ? 'BB' : 'AA');
    expect(verificarToken(alterado, { secreto: SECRETO, ahora: AHORA })).toEqual({ error: 'invalido' });
    expect(verificarToken('basura', { secreto: SECRETO, ahora: AHORA })).toEqual({ error: 'invalido' });
  });

  test('no se puede emitir un token sin secreto', () => {
    expect(() => emitirToken(usuario, {})).toThrow('JWT_SECRET');
  });
});

describe('CP-17 · Bloqueo tras 5 intentos fallidos (HU20-2)', () => {
  test('los 4 primeros fallos solo cuentan; el 5.º bloquea 5 minutos', () => {
    let u = { intentos_fallidos: 0, bloqueado_hasta: null };
    for (let i = 1; i <= 4; i += 1) {
      u = { ...u, ...bloqueo.registrarFallo(u, AHORA) };
      expect(u).toEqual({ intentos_fallidos: i, bloqueado_hasta: null });
    }
    u = { ...u, ...bloqueo.registrarFallo(u, AHORA) };
    expect(u.bloqueado_hasta).toBe('2026-10-20T15:05:00.000Z');
    expect(bloqueo.estaBloqueado(u, AHORA)).toBe(true);
    expect(bloqueo.minutosRestantes(u, new Date('2026-10-20T15:02:30Z'))).toBe(3);
  });

  test('pasados los 5 minutos se desbloquea y el conteo vuelve a empezar', () => {
    const u = { intentos_fallidos: 5, bloqueado_hasta: '2026-10-20T15:05:00.000Z' };
    const despues = new Date('2026-10-20T15:05:01Z');
    expect(bloqueo.estaBloqueado(u, despues)).toBe(false);
    expect(bloqueo.minutosRestantes(u, despues)).toBe(0);
    expect(bloqueo.registrarFallo(u, despues)).toEqual({ intentos_fallidos: 1, bloqueado_hasta: null });
  });

  test('un ingreso correcto reinicia el contador', () => {
    expect(bloqueo.registrarExito()).toEqual({ intentos_fallidos: 0, bloqueado_hasta: null });
  });
});
