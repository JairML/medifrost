// HU06 – Endpoint de estado para el dashboard. Tarea T09 – Jair Menéndez.
// GET /api/estado        → todas las refrigeradoras activas con su última lectura y estado
// GET /api/estado/:id    → una refrigeradora
// Sprint 2: cada refrigeradora trae también sus alertas abiertas y el estado de la energía del nodo.
// Lo pueden consultar todos los roles (también el técnico de farmacia).
const { Router } = require('express');
const { calcularEstado } = require('../validacion/estado');
const { ErrorNoEncontrado } = require('../errores');

// Datos de la alerta que necesita la tarjeta del dashboard (HU12 / HU13 / HU04)
function resumenAlerta(a) {
  return {
    id: a.id, tipo: a.tipo, estado: a.estado, inicio_en: a.inicio_en, notificada_en: a.notificada_en,
    envios: a.envios, valor_extremo: a.valor_extremo === null || a.valor_extremo === undefined ? null : Number(a.valor_extremo),
    bateria_pct: a.bateria_pct ?? null, atendida_en: a.atendida_en, atendida_por: a.atendida_por,
  };
}

async function estadoDe(repo, refrigeradora, sensores, ahora, alertas = []) {
  const sensor = sensores.find((s) => s.refrigeradora_id === refrigeradora.id) || null;
  const lectura = sensor ? await repo.ultimaLectura(sensor.dispositivo_id) : null;
  return {
    refrigeradora: {
      id: refrigeradora.id,
      nombre: refrigeradora.nombre,
      ubicacion: refrigeradora.ubicacion,
      temp_min: Number(refrigeradora.temp_min),
      temp_max: Number(refrigeradora.temp_max),
      tolerancia_min: refrigeradora.tolerancia_min,
    },
    sensor: sensor ? { codigo: sensor.codigo, dispositivo_id: sensor.dispositivo_id } : null,
    lectura: lectura
      ? {
        temperatura: lectura.temperatura === null ? null : Number(lectura.temperatura),
        estado: lectura.estado,
        medido_en: lectura.medido_en,
        alimentacion: lectura.alimentacion ?? null, // HU04: 'externa' | 'bateria' | null
        bateria_pct: lectura.bateria_pct ?? null,
      }
      : null,
    ...calcularEstado({ refrigeradora, sensor, lectura, ahora }),
    // HU12 / HU13 / HU04: alertas avisadas que siguen abiertas (activas o atendidas)
    alertas: alertas.filter((a) => a.refrigeradora_id === refrigeradora.id).map(resumenAlerta),
  };
}

function rutasEstado(repo) {
  const r = Router();

  r.get('/', async (_req, res) => {
    const ahora = new Date();
    const [refrigeradoras, sensores, alertas] = await Promise.all([
      repo.listarRefrigeradoras(), repo.listarSensores(), repo.listarAlertas({ estados: ['activa', 'atendida'], limite: 200 }),
    ]);
    const activas = refrigeradoras.filter((ref) => ref.activa !== false);
    const items = await Promise.all(activas.map((ref) => estadoDe(repo, ref, sensores, ahora, alertas)));
    res.json({ actualizado_en: ahora.toISOString(), refrigeradoras: items });
  });

  r.get('/:id', async (req, res) => {
    const ref = await repo.obtenerRefrigeradora(req.params.id);
    if (!ref) throw new ErrorNoEncontrado('La refrigeradora no existe.');
    const [sensores, alertas] = await Promise.all([
      repo.listarSensores(), repo.listarAlertas({ estados: ['activa', 'atendida'], refrigeradoraId: ref.id, limite: 20 }),
    ]);
    res.json(await estadoDe(repo, ref, sensores, new Date(), alertas));
  });

  return r;
}

module.exports = { rutasEstado };
