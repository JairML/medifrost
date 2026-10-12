// Modo demo (USE_MEMORY_DB=true): genera lecturas de mentira para que el dashboard (HU06)
// se vea «en vivo» sin hardware ni Supabase. NO se usa con la base de datos real.
// Variables opcionales: DEMO_INTERVALO_S (por defecto 10 s).

function iniciarSimulador(repo, { intervaloMs = 10000 } = {}) {
  const temperaturas = new Map(); // dispositivo_id → última temperatura simulada

  async function tick() {
    const sensores = await repo.listarSensores();
    for (const s of sensores) {
      if (!s.refrigeradora_id) continue;
      const anterior = temperaturas.get(s.dispositivo_id) ?? 4.5;
      // paseo aleatorio suave entre 2,5 y 7,5 °C
      const siguiente = Math.min(7.5, Math.max(2.5, anterior + (Math.random() - 0.5) * 0.6));
      temperaturas.set(s.dispositivo_id, siguiente);
      await repo.registrarLectura({
        dispositivo_id: s.dispositivo_id,
        temperatura: Math.round(siguiente * 10) / 10,
        estado: 'ok',
        medido_en: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  const id = setInterval(() => { tick().catch(() => {}); }, intervaloMs);
  id.unref?.();
  return { detener: () => clearInterval(id), tick };
}

module.exports = { iniciarSimulador };
