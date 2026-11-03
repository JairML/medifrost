// CP-14 (Unitaria) – Envío de alertas por correo (HU12, HU13, HU04). Tarea T20 – Ian Flores.
// No se envían correos reales: se usa un transporte falso que guarda lo que recibiría Gmail.
const {
  configCorreoDesdeEnv, correoConfigurado, crearNotificadorCorreo, crearNotificadorConsola, crearNotificador,
} = require('../src/alertas/correo');
const plantillas = require('../src/alertas/plantillas');

const REFRI = { nombre: 'Refrigeradora principal', ubicacion: 'Mostrador', temp_min: 2, temp_max: 8 };
const INICIO = '2026-10-20T15:00:00Z'; // 10:00 en Lima
const AHORA = new Date('2026-10-20T15:16:00Z');

describe('CP-14 · Configuración del correo', () => {
  test('lee Gmail por defecto, quita los espacios de la contraseña de aplicación y separa varios destinatarios', () => {
    const c = configCorreoDesdeEnv({ SMTP_USER: 'medifrost@gmail.com', SMTP_PASS: 'abcd efgh ijkl mnop', ALERTA_DESTINATARIOS: 'dt@botica.pe, dueno@botica.pe' });
    expect(c).toMatchObject({ host: 'smtp.gmail.com', puerto: 465, seguro: true, contrasena: 'abcdefghijklmnop' });
    expect(c.destinatarios).toEqual(['dt@botica.pe', 'dueno@botica.pe']);
    expect(c.remitente).toBe('MediFrost Alertas <medifrost@gmail.com>');
    expect(correoConfigurado(c)).toBe(true);
  });

  test('sin usuario, clave o destinatarios no se considera configurado', () => {
    expect(correoConfigurado(configCorreoDesdeEnv({}))).toBe(false);
    expect(correoConfigurado(configCorreoDesdeEnv({ SMTP_USER: 'a@gmail.com', SMTP_PASS: 'x' }))).toBe(false);
  });

  test('sin configuración usa el notificador de consola (el backend no se cae)', async () => {
    const log = jest.fn();
    const n = crearNotificador({}, { log });
    expect(n.tipo).toBe('consola');
    const r = await n.enviar({ asunto: 'Prueba', texto: 'x' });
    expect(r).toMatchObject({ enviado: true, simulado: true });
    expect(n.enviados).toHaveLength(1);
  });

  test('con configuración crea el transporte SMTP de Gmail', () => {
    const crearTransporte = jest.fn(() => ({ sendMail: jest.fn() }));
    const n = crearNotificador({ SMTP_USER: 'a@gmail.com', SMTP_PASS: 'clave', ALERTA_DESTINATARIOS: 'dt@botica.pe' }, { crearTransporte, log: jest.fn() });
    expect(n.tipo).toBe('correo');
    expect(crearTransporte).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: 'a@gmail.com', pass: 'clave' },
    }));
  });
});

describe('CP-14 · Envío', () => {
  test('envía a todos los destinatarios con asunto, texto y HTML', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: '<id-1>' });
    const n = crearNotificadorCorreo({ transporte: { sendMail }, remitente: 'MediFrost <a@gmail.com>', destinatarios: ['dt@botica.pe', 'dueno@botica.pe'] });
    const r = await n.enviar({ asunto: 'A', texto: 'T', html: '<p>H</p>' });
    expect(r).toEqual({ enviado: true, simulado: false, id: '<id-1>' });
    expect(sendMail).toHaveBeenCalledWith({ from: 'MediFrost <a@gmail.com>', to: 'dt@botica.pe, dueno@botica.pe', subject: 'A', text: 'T', html: '<p>H</p>' });
  });

  test('si Gmail falla, el error se propaga para que el motor reintente', async () => {
    const n = crearNotificadorCorreo({ transporte: { sendMail: jest.fn().mockRejectedValue(new Error('535 Invalid login')) }, remitente: 'x', destinatarios: ['dt@botica.pe'] });
    await expect(n.enviar({ asunto: 'A', texto: 'T' })).rejects.toThrow('535');
  });

  test('no permite crear un notificador sin destinatarios', () => {
    expect(() => crearNotificadorCorreo({ transporte: {}, remitente: 'x', destinatarios: [] })).toThrow(/destinatarios/);
  });

  test('el notificador de consola escribe el asunto en la terminal', async () => {
    const log = jest.fn();
    await crearNotificadorConsola({ log }).enviar({ asunto: 'Hola' });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Hola'));
  });
});

describe('CP-14 · Plantillas (criterio HU12-1: refrigeradora, valor y hora)', () => {
  const alerta = { sentido: 'alta', inicio_en: INICIO, ultimo_valor: 9.4, valor_extremo: 10.2 };

  test('la alerta de temperatura incluye refrigeradora, valor, máximo, hora en Lima y minutos fuera de rango', () => {
    const m = plantillas.alertaTemperatura({ refrigeradora: REFRI, alerta, ahora: AHORA, urlDashboard: 'https://medifrost.vercel.app' });
    expect(m.asunto).toContain('Refrigeradora principal');
    expect(m.asunto).toContain('9.4 °C');
    expect(m.texto).toContain('Máxima alcanzada: 10.2 °C');
    expect(m.texto).toContain('8 °C (máximo)');
    expect(m.texto).toMatch(/20\/10\/2026.*10:00/); // 15:00 UTC = 10:00 en Lima
    expect(m.texto).toContain('16 min');
    expect(m.texto).toContain('cada 30 minutos');
    expect(m.html).toContain('https://medifrost.vercel.app');
  });

  test('la repetición lo indica en el asunto y una excursión baja muestra el mínimo', () => {
    const m = plantillas.alertaTemperatura({ refrigeradora: REFRI, alerta: { ...alerta, sentido: 'baja', ultimo_valor: 1.1, valor_extremo: 0.8 }, ahora: AHORA, repeticion: 2 });
    expect(m.asunto).toContain('(aviso 2)');
    expect(m.texto).toContain('Mínima alcanzada: 0.8 °C');
    expect(m.texto).toContain('2 °C (mínimo)');
  });

  test('normalización, sin señal, señal recuperada, corte, energía restaurada y batería baja tienen su asunto', () => {
    const p = { refrigeradora: REFRI, alerta: { ...alerta, bateria_pct: 18 }, ahora: AHORA };
    expect(plantillas.normalizacionTemperatura(p).asunto).toMatch(/volvió al rango/);
    expect(plantillas.alertaSinSenal(p).asunto).toMatch(/sin señal/);
    expect(plantillas.senalRecuperada(p).asunto).toMatch(/volvió a enviar datos/);
    expect(plantillas.corteEnergia(p).asunto).toMatch(/corte de energía/);
    expect(plantillas.energiaRestaurada(p).texto).toContain('16 min');
    expect(plantillas.bateriaBaja(p).texto).toContain('18 %');
    expect(plantillas.correoPrueba({ ahora: AHORA }).asunto).toMatch(/prueba/);
  });

  test('el HTML escapa los nombres para que no se pueda inyectar código', () => {
    const m = plantillas.alertaTemperatura({ refrigeradora: { ...REFRI, nombre: '<script>x</script>' }, alerta, ahora: AHORA });
    expect(m.html).not.toContain('<script>');
    expect(m.html).toContain('&lt;script&gt;');
  });
});
