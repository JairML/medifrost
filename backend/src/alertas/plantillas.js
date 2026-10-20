// Textos de los correos de alerta (HU12, HU13, HU04). Tarea T20 – Ian Flores.
// Cada función devuelve { asunto, texto, html }. Las horas se muestran en hora de Lima.

const ZONA = 'America/Lima';

function hora(fecha) {
  return new Date(fecha).toLocaleString('es-PE', {
    timeZone: ZONA, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function minutosEntre(desde, hasta) {
  return Math.max(0, Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 60000));
}

const grados = (t) => (t === null || t === undefined ? '—' : `${Number(t).toFixed(1)} °C`);

function escapar(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Arma el correo a partir de un título, un color y una lista de filas [etiqueta, valor].
function armar({ asunto, titulo, color, filas, nota, urlDashboard }) {
  const lineas = filas.map(([k, v]) => `${k}: ${v}`);
  const texto = [titulo, '', ...lineas, '', nota, urlDashboard ? `Ver el dashboard: ${urlDashboard}` : '', '', '— MediFrost · Cadena de frío de medicamentos']
    .filter((l) => l !== undefined)
    .join('\n');

  const filasHtml = filas
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#555">${escapar(k)}</td><td style="padding:4px 0"><strong>${escapar(v)}</strong></td></tr>`)
    .join('');
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px">
  <div style="background:${color};color:#fff;padding:12px 16px;border-radius:8px 8px 0 0;font-size:18px"><strong>${escapar(titulo)}</strong></div>
  <div style="border:1px solid #ddd;border-top:0;padding:16px;border-radius:0 0 8px 8px">
    <table style="border-collapse:collapse;font-size:15px">${filasHtml}</table>
    ${nota ? `<p style="margin:16px 0 0;font-size:14px">${escapar(nota)}</p>` : ''}
    ${urlDashboard ? `<p style="margin:16px 0 0"><a href="${escapar(urlDashboard)}" style="color:#0b6bcb">Ver el dashboard</a></p>` : ''}
    <p style="margin:16px 0 0;font-size:12px;color:#888">MediFrost · Cadena de frío de medicamentos</p>
  </div>
</div>`;
  return { asunto, texto, html };
}

const ROJO = '#c62828';
const VERDE = '#2e7d32';
const GRIS = '#546e7a';
const NARANJA = '#e65100';

/** HU12 – La temperatura lleva fuera del rango más que el tiempo de tolerancia. */
function alertaTemperatura({ refrigeradora, alerta, ahora = new Date(), repeticion = 1, urlDashboard }) {
  const alta = alerta.sentido !== 'baja';
  const limite = alta ? `${refrigeradora.temp_max} °C (máximo)` : `${refrigeradora.temp_min} °C (mínimo)`;
  const aviso = repeticion > 1 ? ` (aviso ${repeticion})` : '';
  return armar({
    asunto: `🔴 MediFrost: ${refrigeradora.nombre} fuera de rango – ${grados(alerta.ultimo_valor)}${aviso}`,
    titulo: `Temperatura fuera de rango${aviso}`,
    color: ROJO,
    filas: [
      ['Refrigeradora', refrigeradora.nombre + (refrigeradora.ubicacion ? ` (${refrigeradora.ubicacion})` : '')],
      ['Temperatura actual', grados(alerta.ultimo_valor)],
      [alta ? 'Máxima alcanzada' : 'Mínima alcanzada', grados(alerta.valor_extremo)],
      ['Límite', limite],
      ['Fuera de rango desde', hora(alerta.inicio_en)],
      ['Tiempo fuera de rango', `${minutosEntre(alerta.inicio_en, ahora)} min`],
    ],
    nota: 'Revise la refrigeradora y marque la alerta como «atendida» en el dashboard. Mientras no se marque, este aviso se repite cada 30 minutos.',
    urlDashboard,
  });
}

/** HU12 – La temperatura volvió al rango. */
function normalizacionTemperatura({ refrigeradora, alerta, ahora = new Date(), urlDashboard }) {
  return armar({
    asunto: `🟢 MediFrost: ${refrigeradora.nombre} volvió al rango – ${grados(alerta.ultimo_valor)}`,
    titulo: 'Temperatura normalizada',
    color: VERDE,
    filas: [
      ['Refrigeradora', refrigeradora.nombre],
      ['Temperatura actual', grados(alerta.ultimo_valor)],
      ['Rango', `${refrigeradora.temp_min} – ${refrigeradora.temp_max} °C`],
      ['Duración de la excursión', `${minutosEntre(alerta.inicio_en, ahora)} min (desde ${hora(alerta.inicio_en)})`],
      [alerta.sentido === 'baja' ? 'Mínima alcanzada' : 'Máxima alcanzada', grados(alerta.valor_extremo)],
    ],
    nota: 'Registre la excursión y evalúe si los medicamentos afectados deben ponerse en cuarentena.',
    urlDashboard,
  });
}

/** HU13 – El nodo dejó de enviar datos. */
function alertaSinSenal({ refrigeradora, alerta, ahora = new Date(), repeticion = 1, urlDashboard }) {
  const aviso = repeticion > 1 ? ` (aviso ${repeticion})` : '';
  return armar({
    asunto: `⚪ MediFrost: ${refrigeradora.nombre} sin señal${aviso}`,
    titulo: `El sensor dejó de enviar datos${aviso}`,
    color: GRIS,
    filas: [
      ['Refrigeradora', refrigeradora.nombre],
      ['Último dato recibido', hora(alerta.inicio_en)],
      ['Sin datos desde hace', `${minutosEntre(alerta.inicio_en, ahora)} min`],
      ['Última temperatura', grados(alerta.ultimo_valor)],
    ],
    nota: 'Puede ser un corte de luz, una caída de internet o un problema del nodo. Verifique la refrigeradora en persona.',
    urlDashboard,
  });
}

/** HU13 – El nodo volvió a enviar datos. */
function senalRecuperada({ refrigeradora, alerta, ahora = new Date(), urlDashboard }) {
  return armar({
    asunto: `🟢 MediFrost: ${refrigeradora.nombre} volvió a enviar datos`,
    titulo: 'Señal recuperada',
    color: VERDE,
    filas: [
      ['Refrigeradora', refrigeradora.nombre],
      ['Tiempo sin datos', `${minutosEntre(alerta.inicio_en, ahora)} min`],
      ['Temperatura actual', grados(alerta.ultimo_valor)],
    ],
    urlDashboard,
  });
}

/** HU04 – El nodo perdió la energía externa y funciona con batería. */
function corteEnergia({ refrigeradora, alerta, urlDashboard }) {
  return armar({
    asunto: `🟠 MediFrost: corte de energía en ${refrigeradora.nombre}`,
    titulo: 'Corte de energía',
    color: NARANJA,
    filas: [
      ['Refrigeradora', refrigeradora.nombre],
      ['Corte detectado', hora(alerta.inicio_en)],
      ['Batería del nodo', alerta.bateria_pct === null || alerta.bateria_pct === undefined ? '—' : `${alerta.bateria_pct} %`],
    ],
    nota: 'El nodo sigue midiendo con su batería de respaldo. Si la refrigeradora también se apagó, la temperatura subirá: revise el equipo.',
    urlDashboard,
  });
}

/** HU04 – Volvió la energía externa. */
function energiaRestaurada({ refrigeradora, alerta, ahora = new Date(), urlDashboard }) {
  return armar({
    asunto: `🟢 MediFrost: volvió la energía en ${refrigeradora.nombre}`,
    titulo: 'Energía restaurada',
    color: VERDE,
    filas: [
      ['Refrigeradora', refrigeradora.nombre],
      ['Duración del corte', `${minutosEntre(alerta.inicio_en, ahora)} min (desde ${hora(alerta.inicio_en)})`],
    ],
    urlDashboard,
  });
}

/** HU04 – La batería del nodo bajó del 20 %. */
function bateriaBaja({ refrigeradora, alerta, urlDashboard }) {
  return armar({
    asunto: `🟠 MediFrost: batería baja en el nodo de ${refrigeradora.nombre}`,
    titulo: 'Batería baja',
    color: NARANJA,
    filas: [
      ['Refrigeradora', refrigeradora.nombre],
      ['Batería', `${alerta.bateria_pct ?? '—'} %`],
      ['Detectado', hora(alerta.inicio_en)],
    ],
    nota: 'Cuando la batería se agote, el nodo dejará de medir. Restablezca la energía o conecte un cargador.',
    urlDashboard,
  });
}

/** Correo de prueba para verificar la configuración (npm run probar-correo). */
function correoPrueba({ ahora = new Date() } = {}) {
  return armar({
    asunto: '✅ MediFrost: correo de prueba',
    titulo: 'La configuración del correo funciona',
    color: VERDE,
    filas: [['Enviado', hora(ahora)]],
    nota: 'Si recibió este mensaje, MediFrost ya puede enviar alertas a esta dirección.',
  });
}

module.exports = {
  alertaTemperatura, normalizacionTemperatura, alertaSinSenal, senalRecuperada,
  corteEnergia, energiaRestaurada, bateriaBaja, correoPrueba, hora, minutosEntre,
};
