// Modo demo (npm run demo): genera lecturas de mentira para que el dashboard (HU06) se vea
// «en vivo» sin hardware ni Supabase. NO se usa con la base de datos real.
// Variables opcionales: DEMO_INTERVALO_S (por defecto 10 s).
//
// Sprint 2: para probar las alertas sin hardware, el simulador se puede controlar
// (lo usan las rutas /api/demo, que solo existen en modo demo):
//   fijar(dispositivo, 9.5)    → manda siempre 9.5 °C (excursión, HU12); fijar(d, null) = error de sensor
//   soltar(dispositivo)        → vuelve a la temperatura aleatoria normal
//   pausar(dispositivo)        → deja de enviar lecturas (para probar «sin señal», HU13)
//   reanudar(dispositivo)
//   energia(dispositivo, { alimentacion: 'bateria', bateria_pct: 60 })  → HU04

function iniciarSimulador(repo, { intervaloMs = 10000 } = {}) {
  const temperaturas = new Map(); // dispositivo_id → última temperatura simulada
  const fijadas = new Map(); // dispositivo_id → temperatura forzada (o null = error de sensor)
  const pausados = new Set();
  const energias = new Map(); // dispositivo_id → { alimentacion, bateria_pct }

  async function tick() {
    const sensores = await repo.listarSensores();
    for (const s of sensores) {
      if (!s.refrigeradora_id || pausados.has(s.dispositivo_id)) continue;
      let temperatura;
      let estado = 'ok';
      if (fijadas.has(s.dispositivo_id)) {
        temperatura = fijadas.get(s.dispositivo_id);
        if (temperatura === null) estado = 'error_sensor';
      } else {
        const anterior = temperaturas.get(s.dispositivo_id) ?? 4.5;
        // paseo aleatorio suave entre 2,5 y 7,5 °C
        const siguiente = Math.min(7.5, Math.max(2.5, anterior + (Math.random() - 0.5) * 0.6));
        temperaturas.set(s.dispositivo_id, siguiente);
        temperatura = Math.round(siguiente * 10) / 10;
      }
      const energia = energias.get(s.dispositivo_id) || { alimentacion: 'externa', bateria_pct: 100 };
      await repo.registrarLectura({
        dispositivo_id: s.dispositivo_id,
        temperatura,
        estado,
        medido_en: new Date().toISOString(),
        alimentacion: energia.alimentacion,
        bateria_pct: energia.bateria_pct,
      }).catch(() => {});
    }
  }

  const id = setInterval(() => { tick().catch(() => {}); }, intervaloMs);
  id.unref?.();

  return {
    detener: () => clearInterval(id),
    tick,
    fijar(dispositivo, temperatura) { fijadas.set(dispositivo, temperatura === null ? null : Number(temperatura)); },
    soltar(dispositivo) { fijadas.delete(dispositivo); },
    pausar(dispositivo) { pausados.add(dispositivo); },
    reanudar(dispositivo) { pausados.delete(dispositivo); },
    energia(dispositivo, datos) { energias.set(dispositivo, { ...(energias.get(dispositivo) || { alimentacion: 'externa', bateria_pct: 100 }), ...datos }); },
    estado(dispositivo) {
      return {
        fijada: fijadas.has(dispositivo) ? fijadas.get(dispositivo) : undefined,
        pausado: pausados.has(dispositivo),
        energia: energias.get(dispositivo) || { alimentacion: 'externa', bateria_pct: 100 },
      };
    },
  };
}

module.exports = { iniciarSimulador };
