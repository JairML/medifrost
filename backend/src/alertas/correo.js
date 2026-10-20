// Envío de alertas por correo electrónico con Gmail (HU12, HU13, HU04). Tarea T20 – Ian Flores.
// Decisión SAM (03/10/2026): alertas por correo con Gmail SMTP + Nodemailer.
//
// Si faltan los datos del correo en el .env, el sistema NO se cae: usa el
// «notificador de consola», que solo escribe el mensaje en la terminal.
// Así se puede programar y probar sin una cuenta de Gmail.
const nodemailer = require('nodemailer');

/** Lee la configuración del correo desde las variables de entorno. */
function configCorreoDesdeEnv(env = process.env) {
  const puerto = Number(env.SMTP_PORT) || 465;
  const usuario = (env.SMTP_USER || '').trim();
  return {
    host: (env.SMTP_HOST || 'smtp.gmail.com').trim(),
    puerto,
    seguro: puerto === 465, // 465 = SSL directo; 587 = STARTTLS
    usuario,
    contrasena: (env.SMTP_PASS || '').replace(/\s+/g, ''), // Gmail muestra la contraseña de aplicación en grupos de 4
    remitente: (env.ALERTA_REMITENTE || (usuario ? `MediFrost Alertas <${usuario}>` : '')).trim(),
    destinatarios: (env.ALERTA_DESTINATARIOS || '')
      .split(/[,;]/)
      .map((c) => c.trim())
      .filter(Boolean),
  };
}

/** ¿Están todos los datos necesarios para enviar correos de verdad? */
function correoConfigurado(config) {
  return Boolean(config.usuario && config.contrasena && config.destinatarios.length > 0);
}

/**
 * Notificador que envía correos reales.
 * @param {object} p
 * @param {{ sendMail: Function }} p.transporte  transporte de Nodemailer (en las pruebas, uno falso)
 * @param {string} p.remitente
 * @param {string[]} p.destinatarios
 */
function crearNotificadorCorreo({ transporte, remitente, destinatarios }) {
  if (!destinatarios || destinatarios.length === 0) throw new Error('No hay destinatarios para las alertas (ALERTA_DESTINATARIOS).');
  return {
    tipo: 'correo',
    destinatarios: [...destinatarios],
    async enviar({ asunto, texto, html }) {
      const info = await transporte.sendMail({ from: remitente, to: destinatarios.join(', '), subject: asunto, text: texto, html });
      return { enviado: true, simulado: false, id: info?.messageId ?? null };
    },
  };
}

/** Notificador de respaldo: escribe el correo en la consola (sin Gmail configurado o en pruebas). */
function crearNotificadorConsola({ log = console.log } = {}) {
  const enviados = [];
  return {
    tipo: 'consola',
    destinatarios: [],
    enviados, // las pruebas pueden revisar qué se habría enviado
    async enviar(mensaje) {
      enviados.push(mensaje);
      log(`📧 [correo simulado] ${mensaje.asunto}`);
      return { enviado: true, simulado: true, id: null };
    },
  };
}

/** Elige el notificador según el .env: Gmail si está configurado, consola si no. */
function crearNotificador(env = process.env, { log = console.log, crearTransporte = nodemailer.createTransport } = {}) {
  const config = configCorreoDesdeEnv(env);
  if (!correoConfigurado(config)) {
    log('Aviso: el correo de alertas no está configurado (SMTP_USER, SMTP_PASS, ALERTA_DESTINATARIOS). Las alertas se mostrarán solo en la consola.');
    return crearNotificadorConsola({ log });
  }
  const transporte = crearTransporte({
    host: config.host,
    port: config.puerto,
    secure: config.seguro,
    auth: { user: config.usuario, pass: config.contrasena },
    connectionTimeout: 10000, // RNF05: la alerta debe salir en menos de 1 minuto
  });
  return crearNotificadorCorreo({ transporte, remitente: config.remitente, destinatarios: config.destinatarios });
}

module.exports = { configCorreoDesdeEnv, correoConfigurado, crearNotificadorCorreo, crearNotificadorConsola, crearNotificador };
