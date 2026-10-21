// Tarea programada de las alertas (HU13-1 y HU12). Tarea T23 – Jair Menéndez.
// Cada ciclo (por defecto cada 30 s, es decir, al menos una vez por minuto) revisa
// cada refrigeradora activa con sensor:
//   1. «sin señal»: ¿el nodo dejó de enviar datos por 10 min o más? (HU13)
//   2. temperatura: ¿lleva fuera de rango más que la tolerancia? (HU12)
//   3. eventos del nodo pendientes: corte de energía, energía restaurada, batería baja (HU04)
// Las decisiones las toma el motor (motor.js); aquí solo se guardan y se envían los correos.
//
// Regla importante: PRIMERO se envía el correo y DESPUÉS se guarda el cambio.
// Si Gmail falla, no se guarda nada y el siguiente ciclo lo vuelve a intentar.
const motor = require('./motor');
const plantillas = require('./plantillas');

function crearVigilante({ repo, notificador, intervaloMs = 30000, urlDashboard = null, reloj = () => new Date(), log = console }) {
  let temporizador = null;
  let enCurso = null;

  async function aplicar(decision, { refrigeradora, alertaActual }) {
    if (!decision || decision.accion === 'ninguna') return null;
    const ahora = reloj();

    // Cómo quedará la alerta después del cambio (para armar el correo con los datos nuevos)
    const resultado = decision.accion === 'crear'
      ? { ...decision.alerta }
      : { ...alertaActual, ...decision.cambios };

    if (decision.correo) {
      const plantilla = plantillas[decision.correo];
      const mensaje = plantilla({ refrigeradora, alerta: resultado, ahora, repeticion: resultado.envios || 1, urlDashboard });
      await notificador.enviar(mensaje); // si falla, lanza el error y no se guarda nada
      log.info?.(`Alerta enviada: ${mensaje.asunto}`);
    }

    if (decision.accion === 'crear') return repo.crearAlerta(decision.alerta);
    return repo.actualizarAlerta(decision.id || alertaActual.id, decision.cambios);
  }

  async function revisarRefrigeradora(refrigeradora, sensor, ahora) {
    const abiertas = await repo.alertasAbiertas(refrigeradora.id);
    const porTipo = Object.fromEntries(abiertas.map((a) => [a.tipo, a]));
    const lectura = await repo.ultimaLectura(sensor.dispositivo_id);

    // 1) HU13 – sin señal
    const dSenal = motor.evaluarSinSenal({ refrigeradora, sensor, lectura, alerta: porTipo.sin_senal || null, ahora });
    await aplicar(dSenal, { refrigeradora, alertaActual: porTipo.sin_senal });

    // 2) HU12 – temperatura (solo si hay datos recientes; si no, ya avisó «sin señal»)
    const dTemp = motor.evaluarTemperatura({ refrigeradora, lectura, alerta: porTipo.temperatura || null, ahora });
    await aplicar(dTemp, { refrigeradora, alertaActual: porTipo.temperatura });
  }

  async function procesarEventos(refrigeradoras, sensores, ahora) {
    const eventos = await repo.eventosPendientes();
    for (const evento of eventos) {
      const sensor = sensores.find((s) => s.dispositivo_id === evento.dispositivo_id);
      const refrigeradora = sensor && refrigeradoras.find((r) => r.id === sensor.refrigeradora_id);
      if (refrigeradora) {
        const abiertas = await repo.alertasAbiertas(refrigeradora.id);
        const porTipo = Object.fromEntries(abiertas.map((a) => [a.tipo, a]));
        const decisiones = motor.evaluarEvento({ refrigeradora, evento, abiertas: porTipo, ahora });
        for (const d of decisiones) await aplicar(d, { refrigeradora, alertaActual: porTipo[d.tipo] });
      }
      // Se marca procesado también si el dispositivo no está vinculado (no hay a quién avisar)
      await repo.marcarEventoProcesado(evento.id, ahora.toISOString());
    }
  }

  /** Un ciclo completo de revisión. Devuelve cuántos errores hubo (0 = todo bien). */
  async function revisar() {
    const ahora = reloj();
    let errores = 0;
    const [refrigeradoras, sensores] = await Promise.all([repo.listarRefrigeradoras(), repo.listarSensores()]);
    const activas = refrigeradoras.filter((r) => r.activa !== false);

    for (const refrigeradora of activas) {
      const sensor = sensores.find((s) => s.refrigeradora_id === refrigeradora.id);
      if (!sensor) continue;
      try {
        await revisarRefrigeradora(refrigeradora, sensor, ahora);
      } catch (e) {
        errores += 1; // una refrigeradora con problemas no detiene a las demás
        log.error?.(`Alertas: no se pudo revisar «${refrigeradora.nombre}»: ${e.message}`);
      }
    }

    try {
      await procesarEventos(activas, sensores, ahora);
    } catch (e) {
      errores += 1;
      log.error?.(`Alertas: no se pudieron procesar los eventos del nodo: ${e.message}`);
    }
    return errores;
  }

  /** Evita que dos ciclos se ejecuten a la vez si uno se demora (por ejemplo, Gmail lento). */
  function ciclo() {
    if (enCurso) return enCurso;
    enCurso = revisar()
      .catch((e) => { log.error?.(`Alertas: error en el ciclo: ${e.message}`); return 1; })
      .finally(() => { enCurso = null; });
    return enCurso;
  }

  return {
    revisar,
    ciclo,
    iniciar() {
      if (temporizador) return;
      temporizador = setInterval(ciclo, intervaloMs);
      temporizador.unref?.();
      log.info?.(`Alertas: revisión automática cada ${Math.round(intervaloMs / 1000)} s (correo: ${notificador.tipo}).`);
    },
    detener() {
      clearInterval(temporizador);
      temporizador = null;
    },
  };
}

module.exports = { crearVigilante };
