// HU23 – Modelo de predicción: ¿cuándo se saldrá del rango la refrigeradora y está fallando el sensor?
// Sprint 3 · Lógica pura (no depende de la base de datos), por eso se prueba con datos de ejemplo.
//
// 1) Tendencia de la temperatura: regresión lineal (mínimos cuadrados) sobre las lecturas de los
//    últimos 20 min. Con la recta se estima en cuántos minutos se cruzará temp_max o temp_min.
//    Solo se anuncia un cruce si la recta explica bien los datos (R² ≥ 0,5); si faltan ≤ 15 min
//    se marca «aviso preventivo»:
//    la DT puede actuar ANTES de que exista la excursión y de que llegue la alerta por correo.
// 2) Salud del sensor (últimas 12 h): lecturas perdidas, lecturas con error, valores imposibles
//    del DS18B20 (85 °C de reinicio) y lecturas «congeladas» (mismo valor durante 1 h).
//    Con esos indicadores se clasifica el riesgo de falla: ok · atención · falla probable.

const VENTANA_TENDENCIA_MIN = 20; // 20 min: avisa ~6 min antes que con 30 min, sin falsos avisos preventivos en la simulación
const MIN_LECTURAS_TENDENCIA = 5;
const MIN_TRAMO_MIN = 10; // las lecturas deben cubrir al menos 10 min (con menos, el ruido parece tendencia)
const HORIZONTE_MIN = 120; // no se anuncian cruces a más de 2 h: la recta deja de ser confiable
const UMBRAL_PREVENTIVO_MIN = 15;
const R2_MINIMO = 0.5;
const PENDIENTE_ESTABLE = 0.01; // °C/min (0,1 °C cada 10 min) → «estable»

const VENTANA_SALUD_H = 12;
const INTERVALO_ESPERADO_S = 60; // el nodo envía una lectura por minuto
const VENTANA_CONGELADO_MIN = 60;
const MIN_LECTURAS_CONGELADO = 10;
const VALOR_REINICIO_DS18B20 = 85; // el DS18B20 devuelve 85 °C si se lee antes de convertir

const minutosEntre = (desde, hasta) => (new Date(hasta).getTime() - new Date(desde).getTime()) / 60000;
const redondear = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const esValida = (l) => l && l.estado !== 'error_sensor' && l.temperatura !== null && l.temperatura !== undefined
  && Number.isFinite(Number(l.temperatura));

/**
 * Regresión lineal simple y = a + b·x por mínimos cuadrados.
 * @param {{x:number,y:number}[]} puntos
 * @returns {{pendiente:number, intercepto:number, r2:number}|null}  null si no se puede calcular
 */
function regresionLineal(puntos) {
  const n = puntos.length;
  if (n < 2) return null;
  const mx = puntos.reduce((s, p) => s + p.x, 0) / n;
  const my = puntos.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of puntos) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) ** 2;
  }
  if (sxx === 0) return null; // todas las lecturas en el mismo instante
  const pendiente = sxy / sxx;
  const intercepto = my - pendiente * mx;
  // R² = 1 si todos los puntos son iguales (la recta horizontal los explica perfectamente)
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { pendiente, intercepto, r2 };
}

/**
 * Predice si la temperatura saldrá del rango y en cuántos minutos.
 * @param {object} p
 * @param {object[]} p.lecturas  lecturas { temperatura, estado, medido_en } (cualquier orden)
 * @param {number} p.tempMin
 * @param {number} p.tempMax
 * @param {Date} [p.ahora]
 */
function predecirExcursion({ lecturas, tempMin, tempMax, ahora = new Date() }) {
  const desde = ahora.getTime() - VENTANA_TENDENCIA_MIN * 60000;
  const puntos = (lecturas || [])
    .filter((l) => esValida(l) && new Date(l.medido_en).getTime() >= desde && new Date(l.medido_en).getTime() <= ahora.getTime())
    .map((l) => ({ x: minutosEntre(ahora, l.medido_en), y: Number(l.temperatura) })); // x ≤ 0: minutos antes de «ahora»

  const base = { disponible: false, ventana_min: VENTANA_TENDENCIA_MIN, lecturas_usadas: puntos.length };
  if (puntos.length < MIN_LECTURAS_TENDENCIA) {
    return { ...base, motivo: `Se necesitan al menos ${MIN_LECTURAS_TENDENCIA} lecturas de los últimos ${VENTANA_TENDENCIA_MIN} min.` };
  }
  const tramo = -Math.min(...puntos.map((p) => p.x));
  if (tramo < MIN_TRAMO_MIN) {
    return { ...base, motivo: `Se necesitan lecturas de al menos ${MIN_TRAMO_MIN} min para estimar la tendencia.` };
  }
  const recta = regresionLineal(puntos);
  if (!recta) return { ...base, motivo: 'No se pudo calcular la tendencia.' };

  const { pendiente, intercepto, r2 } = recta;
  const estimada = intercepto; // valor de la recta en x = 0 (ahora)
  let tendencia = 'estable';
  if (pendiente > PENDIENTE_ESTABLE) tendencia = 'subiendo';
  else if (pendiente < -PENDIENTE_ESTABLE) tendencia = 'bajando';

  const confiable = r2 >= R2_MINIMO;
  let limite = null;
  let minutos = null;
  if (estimada > tempMax) {
    limite = 'max'; minutos = 0;
  } else if (estimada < tempMin) {
    limite = 'min'; minutos = 0;
  } else if (!confiable) {
    // R² bajo: las lecturas suben y bajan sin una dirección clara → no se anuncia ningún cruce
  } else if (tendencia === 'subiendo') {
    const t = (tempMax - estimada) / pendiente;
    if (t <= HORIZONTE_MIN) { limite = 'max'; minutos = Math.max(0, Math.round(t)); }
  } else if (tendencia === 'bajando') {
    const t = (tempMin - estimada) / pendiente;
    if (t <= HORIZONTE_MIN) { limite = 'min'; minutos = Math.max(0, Math.round(t)); }
  }

  return {
    ...base,
    disponible: true,
    tendencia,
    pendiente_c_10min: redondear(pendiente * 10),
    temperatura_estimada: redondear(estimada, 1),
    r2: redondear(r2),
    confiable,
    limite, // 'max' | 'min' | null
    minutos_para_salir: minutos, // null = no se sale en las próximas 2 h
    preventiva: minutos !== null && minutos > 0 && minutos <= UMBRAL_PREVENTIVO_MIN && confiable,
  };
}

/**
 * Indicadores de salud del sensor y riesgo de falla.
 * @param {object} p
 * @param {object[]} p.lecturas  lecturas { temperatura, estado, medido_en } de las últimas horas
 * @param {Date} [p.ahora]
 */
function saludSensor({ lecturas, ahora = new Date() }) {
  const desde = ahora.getTime() - VENTANA_SALUD_H * 3600000;
  const enVentana = (lecturas || [])
    .filter((l) => new Date(l.medido_en).getTime() >= desde && new Date(l.medido_en).getTime() <= ahora.getTime())
    .sort((a, b) => new Date(a.medido_en) - new Date(b.medido_en));

  if (enVentana.length === 0) {
    return { disponible: false, ventana_h: VENTANA_SALUD_H, motivo: 'Sin lecturas en las últimas horas.' };
  }

  // Lecturas esperadas desde la primera lectura de la ventana (si el nodo se instaló hace poco)
  const minutosObservados = Math.max(1, minutosEntre(enVentana[0].medido_en, ahora));
  const esperadas = Math.max(enVentana.length, Math.floor((minutosObservados * 60) / INTERVALO_ESPERADO_S));
  const recibidas = enVentana.length;
  const errores = enVentana.filter((l) => !esValida(l)).length;
  const reinicios = enVentana.filter((l) => esValida(l) && Number(l.temperatura) === VALOR_REINICIO_DS18B20).length;

  const ultimaHora = enVentana.filter((l) => esValida(l) && minutosEntre(l.medido_en, ahora) <= VENTANA_CONGELADO_MIN);
  const congelado = ultimaHora.length >= MIN_LECTURAS_CONGELADO
    && ultimaHora.every((l) => Number(l.temperatura) === Number(ultimaHora[0].temperatura));

  const perdidasPct = redondear((1 - recibidas / esperadas) * 100, 1);
  const erroresPct = redondear((errores / recibidas) * 100, 1);

  const motivos = [];
  if (erroresPct >= 5) motivos.push(`${erroresPct} % de lecturas con error de sensor`);
  if (perdidasPct >= 20) motivos.push(`${perdidasPct} % de lecturas perdidas`);
  if (reinicios > 0) motivos.push(`${reinicios} lectura(s) de 85 °C (reinicio del sensor)`);
  if (congelado) motivos.push(`valor sin cambios durante ${VENTANA_CONGELADO_MIN} min`);

  let riesgo = 'ok';
  if (erroresPct >= 20 || perdidasPct >= 50 || (congelado && erroresPct >= 5)) riesgo = 'falla_probable';
  else if (motivos.length > 0) riesgo = 'atencion';

  return {
    disponible: true,
    ventana_h: VENTANA_SALUD_H,
    recibidas,
    esperadas,
    perdidas_pct: Math.max(0, perdidasPct),
    errores_pct: erroresPct,
    reinicios_85: reinicios,
    congelado,
    riesgo, // 'ok' | 'atencion' | 'falla_probable'
    motivos,
  };
}

module.exports = {
  regresionLineal,
  predecirExcursion,
  saludSensor,
  VENTANA_TENDENCIA_MIN,
  VENTANA_SALUD_H,
  UMBRAL_PREVENTIVO_MIN,
  HORIZONTE_MIN,
};
