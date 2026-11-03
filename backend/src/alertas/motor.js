// Motor de reglas de las alertas (HU12, HU13, HU04). Tareas T19 y T23 – Jair Menéndez.
// Lógica PURA: recibe la situación actual y devuelve qué hacer. No toca la base de datos
// ni envía correos (eso lo hace el vigilante), por eso se prueba con datos de ejemplo.
//
// Cada función devuelve una «decisión»:
//   { accion: 'ninguna' }
//   { accion: 'crear',      alerta: {...} }                      → guardar una alerta nueva
//   { accion: 'actualizar', cambios: {...} }                     → actualizar la alerta abierta
//   ...y si hay que avisar, además:  correo: '<plantilla>'  (nombre de la plantilla de plantillas.js)
const { MINUTOS_SIN_SENAL } = require('../validacion/estado');

const REPETIR_CADA_MIN = 30;      // HU12-2: se repite cada 30 min hasta que la marquen como atendida
const BATERIA_BAJA_PCT = 20;      // HU04-2
const ESTADOS_ABIERTOS = ['pendiente', 'activa', 'atendida'];

const minutosEntre = (desde, hasta) => (new Date(hasta).getTime() - new Date(desde).getTime()) / 60000;

/** Temperatura válida de una lectura, o null si es un error de sensor. */
function temperaturaDe(lectura) {
  if (!lectura || lectura.estado === 'error_sensor' || lectura.temperatura === null || lectura.temperatura === undefined) return null;
  return Number(lectura.temperatura);
}

/** 'alta' si está por encima del máximo, 'baja' si está por debajo del mínimo, null si está en rango. */
function sentidoFuera(t, refrigeradora) {
  if (t > Number(refrigeradora.temp_max)) return 'alta';
  if (t < Number(refrigeradora.temp_min)) return 'baja';
  return null;
}

/** Valor más alejado del rango entre el extremo guardado y la lectura nueva. */
function nuevoExtremo(alerta, t) {
  if (alerta.valor_extremo === null || alerta.valor_extremo === undefined) return t;
  const extremo = Number(alerta.valor_extremo);
  return alerta.sentido === 'baja' ? Math.min(extremo, t) : Math.max(extremo, t);
}

/** ¿Toca repetir el correo? (alerta activa, no atendida, 30 min desde el último envío) */
function tocaRepetir(alerta, ahora) {
  return alerta.estado === 'activa' && alerta.ultimo_envio_en && minutosEntre(alerta.ultimo_envio_en, ahora) >= REPETIR_CADA_MIN;
}

function datosEnvio(alerta, ahora) {
  return {
    ultimo_envio_en: new Date(ahora).toISOString(),
    envios: (alerta.envios || 0) + 1,
  };
}

/**
 * HU12 – Temperatura fuera de rango durante más que la tolerancia.
 * @param {object} p
 * @param {object} p.refrigeradora  { id, temp_min, temp_max, tolerancia_min }
 * @param {object|null} p.lectura   última lectura del nodo
 * @param {object|null} p.alerta    alerta de temperatura abierta (pendiente, activa o atendida), o null
 * @param {Date} [p.ahora]
 */
function evaluarTemperatura({ refrigeradora, lectura, alerta = null, ahora = new Date() }) {
  const t = temperaturaDe(lectura);
  // Sin dato válido (error de sensor o nodo sin señal) no se decide nada sobre la temperatura:
  // el error de sensor se ve en el dashboard y la falta de datos la cubre «sin señal» (HU13).
  if (t === null) return { accion: 'ninguna' };
  if (lectura && minutosEntre(lectura.medido_en, ahora) >= MINUTOS_SIN_SENAL) return { accion: 'ninguna' };

  const sentido = sentidoFuera(t, refrigeradora);
  const isoAhora = new Date(ahora).toISOString();

  if (!alerta) {
    if (!sentido) return { accion: 'ninguna' };
    // Empieza la excursión: se guarda como «pendiente» y se espera el tiempo de tolerancia.
    return {
      accion: 'crear',
      alerta: {
        refrigeradora_id: refrigeradora.id,
        tipo: 'temperatura',
        estado: 'pendiente',
        sentido,
        inicio_en: lectura.medido_en,
        envios: 0,
        valor_extremo: t,
        ultimo_valor: t,
      },
    };
  }

  // La temperatura volvió al rango
  if (!sentido) {
    if (alerta.estado === 'pendiente') {
      // Volvió antes de cumplir la tolerancia: no se avisa (evita falsas alarmas).
      return { accion: 'actualizar', cambios: { estado: 'descartada', ultimo_valor: t, cerrada_en: isoAhora } };
    }
    // HU12-3: aviso de normalización (aunque ya esté atendida)
    return {
      accion: 'actualizar',
      cambios: { estado: 'cerrada', ultimo_valor: t, cerrada_en: isoAhora, ...datosEnvio(alerta, ahora) },
      correo: 'normalizacionTemperatura',
    };
  }

  const cambios = { ultimo_valor: t, valor_extremo: nuevoExtremo(alerta, t) };

  if (alerta.estado === 'pendiente') {
    const tolerancia = Number(refrigeradora.tolerancia_min) || 15;
    if (minutosEntre(alerta.inicio_en, ahora) >= tolerancia) {
      // HU12-1: cumplió la tolerancia → primer correo
      return {
        accion: 'actualizar',
        cambios: { ...cambios, estado: 'activa', notificada_en: isoAhora, ...datosEnvio(alerta, ahora) },
        correo: 'alertaTemperatura',
      };
    }
    return { accion: 'actualizar', cambios };
  }

  if (tocaRepetir(alerta, ahora)) {
    // HU12-2: sigue fuera de rango y nadie la marcó como atendida → se repite
    return { accion: 'actualizar', cambios: { ...cambios, ...datosEnvio(alerta, ahora) }, correo: 'alertaTemperatura' };
  }
  return { accion: 'actualizar', cambios };
}

/**
 * HU13 – El nodo dejó de enviar datos por 10 minutos o más.
 * @param {object} p
 * @param {object} p.refrigeradora
 * @param {object|null} p.sensor    sensor vinculado (sin sensor no hay a quién vigilar)
 * @param {object|null} p.lectura   última lectura recibida
 * @param {object|null} p.alerta    alerta «sin señal» abierta, o null
 * @param {Date} [p.ahora]
 */
function evaluarSinSenal({ refrigeradora, sensor, lectura, alerta = null, ahora = new Date() }) {
  // Si el nodo nunca envió datos no se considera «caído» (todavía no se instaló).
  if (!sensor || !lectura) return { accion: 'ninguna' };
  const minutos = minutosEntre(lectura.medido_en, ahora);
  const ultimoValor = temperaturaDe(lectura);
  const isoAhora = new Date(ahora).toISOString();

  if (minutos >= MINUTOS_SIN_SENAL) {
    if (!alerta) {
      return {
        accion: 'crear',
        alerta: {
          refrigeradora_id: refrigeradora.id,
          tipo: 'sin_senal',
          estado: 'activa',
          inicio_en: lectura.medido_en, // desde el último dato recibido
          notificada_en: isoAhora,
          ultimo_envio_en: isoAhora,
          envios: 1,
          ultimo_valor: ultimoValor,
        },
        correo: 'alertaSinSenal',
      };
    }
    if (tocaRepetir(alerta, ahora)) {
      return { accion: 'actualizar', cambios: datosEnvio(alerta, ahora), correo: 'alertaSinSenal' };
    }
    return { accion: 'ninguna' };
  }

  // Volvieron los datos
  if (alerta) {
    return {
      accion: 'actualizar',
      cambios: { estado: 'cerrada', cerrada_en: isoAhora, ultimo_valor: ultimoValor, ...datosEnvio(alerta, ahora) },
      correo: 'senalRecuperada',
    };
  }
  return { accion: 'ninguna' };
}

/**
 * HU04 – Eventos que envía el nodo: corte de energía, energía restaurada y batería baja.
 * Puede devolver varias decisiones (por ejemplo, al volver la energía se cierran el corte y la batería baja).
 * @param {object} p
 * @param {object} p.refrigeradora
 * @param {object} p.evento         { tipo, bateria_pct, ocurrido_en }
 * @param {object} p.abiertas       alertas abiertas de la refrigeradora, por tipo: { corte_energia, bateria_baja, ... }
 * @param {Date} [p.ahora]
 * @returns {Array<object>} decisiones, cada una con { tipo, accion, alerta|cambios, correo? }
 */
function evaluarEvento({ refrigeradora, evento, abiertas = {}, ahora = new Date() }) {
  const isoAhora = new Date(ahora).toISOString();
  const bateria = evento.bateria_pct ?? null;
  const nueva = (tipo, correo) => ({
    tipo,
    accion: 'crear',
    alerta: {
      refrigeradora_id: refrigeradora.id,
      tipo,
      estado: 'activa',
      inicio_en: evento.ocurrido_en,
      notificada_en: isoAhora,
      ultimo_envio_en: isoAhora,
      envios: 1,
      bateria_pct: bateria,
    },
    correo,
  });

  if (evento.tipo === 'corte_energia') {
    if (abiertas.corte_energia) return []; // ya avisado (evento repetido)
    return [nueva('corte_energia', 'corteEnergia')];
  }

  if (evento.tipo === 'bateria_baja') {
    if (abiertas.bateria_baja) return [];
    if (bateria !== null && bateria >= BATERIA_BAJA_PCT) return [];
    return [nueva('bateria_baja', 'bateriaBaja')];
  }

  if (evento.tipo === 'energia_restaurada') {
    const decisiones = [];
    if (abiertas.corte_energia) {
      decisiones.push({
        tipo: 'corte_energia',
        accion: 'actualizar',
        id: abiertas.corte_energia.id,
        cambios: { estado: 'cerrada', cerrada_en: isoAhora, bateria_pct: bateria, ...datosEnvio(abiertas.corte_energia, ahora) },
        correo: 'energiaRestaurada',
      });
    }
    if (abiertas.bateria_baja) {
      // Con energía externa la batería se recarga: se cierra sin otro correo.
      decisiones.push({
        tipo: 'bateria_baja',
        accion: 'actualizar',
        id: abiertas.bateria_baja.id,
        cambios: { estado: 'cerrada', cerrada_en: isoAhora, bateria_pct: bateria },
      });
    }
    return decisiones;
  }

  return [];
}

module.exports = {
  evaluarTemperatura, evaluarSinSenal, evaluarEvento,
  temperaturaDe, sentidoFuera, REPETIR_CADA_MIN, BATERIA_BAJA_PCT, ESTADOS_ABIERTOS,
};
