#!/usr/bin/env node
// Envía un correo de prueba con la configuración del .env (HU12, tarea T20 – Ian Flores).
// Uso (desde la carpeta backend):   npm run probar-correo
// Sirve para comprobar la contraseña de aplicación de Gmail antes de activar las alertas.
require('dotenv').config();
const { crearNotificador, configCorreoDesdeEnv, correoConfigurado } = require('../src/alertas/correo');
const { correoPrueba } = require('../src/alertas/plantillas');

(async () => {
  const config = configCorreoDesdeEnv(process.env);
  if (!correoConfigurado(config)) {
    console.error('✘ Falta configurar el correo en backend/.env: SMTP_USER, SMTP_PASS y ALERTA_DESTINATARIOS.');
    console.error('  Revisa la guía del paquete 13 (contraseña de aplicación de Gmail).');
    process.exit(1);
  }
  console.log(`Enviando un correo de prueba desde ${config.usuario} a ${config.destinatarios.join(', ')}...`);
  const notificador = crearNotificador(process.env);
  const inicio = Date.now();
  try {
    const r = await notificador.enviar(correoPrueba());
    console.log(`✔ Correo enviado en ${Date.now() - inicio} ms (id ${r.id}). Revisa la bandeja de entrada (y la carpeta Spam).`);
  } catch (e) {
    console.error(`✘ No se pudo enviar: ${e.message}`);
    if (/Invalid login|535|Username and Password not accepted/i.test(e.message)) {
      console.error('  Gmail rechazó la clave. Usa una «contraseña de aplicación» (16 letras), no la contraseña normal de la cuenta.');
    }
    process.exit(1);
  }
})();
