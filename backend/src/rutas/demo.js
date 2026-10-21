// Rutas de control del MODO DEMO (solo existen con «npm run demo»; nunca con Supabase).
// Permiten probar las alertas del Sprint 2 sin hardware. Tarea T19 – Jair Menéndez.
//   POST /api/demo/temperatura   { dispositivo_id, temperatura }  → fija la temperatura (null = error de sensor)
//   POST /api/demo/normal        { dispositivo_id }               → vuelve a la temperatura aleatoria normal
//   POST /api/demo/pausar        { dispositivo_id }               → el nodo deja de enviar (HU13)
//   POST /api/demo/reanudar      { dispositivo_id }
//   POST /api/demo/evento        { dispositivo_id, tipo, bateria_pct }  → corte_energia | energia_restaurada | bateria_baja (HU04)
//   GET  /api/demo/:dispositivo_id → cómo está simulado ese nodo
const { Router } = require('express');

const TIPOS_EVENTO = ['corte_energia', 'energia_restaurada', 'bateria_baja'];

function rutasDemo({ repo, simulador, vigilante }) {
  const r = Router();

  const dispositivo = (req) => String(req.body?.dispositivo_id || 'MF-NODO-01').trim();
  // Después de cada cambio se revisan las alertas al instante (en vez de esperar el próximo ciclo)
  const revisar = async () => { await simulador.tick(); if (vigilante) await vigilante.ciclo(); };

  r.post('/temperatura', async (req, res) => {
    const t = req.body?.temperatura;
    if (t !== null && !Number.isFinite(Number(t))) return res.status(400).json({ errores: ['temperatura debe ser un número o null.'] });
    simulador.fijar(dispositivo(req), t === null ? null : Number(t));
    await revisar();
    res.json({ ok: true, ...simulador.estado(dispositivo(req)) });
  });

  r.post('/normal', async (req, res) => {
    simulador.soltar(dispositivo(req));
    await revisar();
    res.json({ ok: true, ...simulador.estado(dispositivo(req)) });
  });

  r.post('/pausar', (req, res) => {
    simulador.pausar(dispositivo(req));
    res.json({ ok: true, aviso: 'El nodo simulado dejó de enviar. La alerta «sin señal» llega a los 10 minutos.', ...simulador.estado(dispositivo(req)) });
  });

  r.post('/reanudar', async (req, res) => {
    simulador.reanudar(dispositivo(req));
    await revisar();
    res.json({ ok: true, ...simulador.estado(dispositivo(req)) });
  });

  r.post('/evento', async (req, res) => {
    const tipo = String(req.body?.tipo || '');
    if (!TIPOS_EVENTO.includes(tipo)) return res.status(400).json({ errores: [`tipo debe ser: ${TIPOS_EVENTO.join(', ')}.`] });
    const d = dispositivo(req);
    const bateria = req.body?.bateria_pct === undefined ? null : Number(req.body.bateria_pct);
    simulador.energia(d, { alimentacion: tipo === 'energia_restaurada' ? 'externa' : 'bateria', ...(bateria === null ? {} : { bateria_pct: bateria }) });
    await repo.registrarEvento({ dispositivo_id: d, tipo, bateria_pct: bateria });
    await revisar();
    res.json({ ok: true, ...simulador.estado(d) });
  });

  r.get('/:dispositivo_id', (req, res) => res.json(simulador.estado(req.params.dispositivo_id)));

  return r;
}

module.exports = { rutasDemo };
