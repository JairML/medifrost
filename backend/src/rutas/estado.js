// HU06 – Endpoint de estado para el dashboard. Tarea T09 – Jair Menéndez.
// GET /api/estado        → todas las refrigeradoras activas con su última lectura y estado
// GET /api/estado/:id    → una refrigeradora
// Lo pueden consultar todos los roles (también el técnico de farmacia).
const { Router } = require('express');
const { calcularEstado } = require('../validacion/estado');
const { ErrorNoEncontrado } = require('../errores');

async function estadoDe(repo, refrigeradora, sensores, ahora) {
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
      ? { temperatura: lectura.temperatura === null ? null : Number(lectura.temperatura), estado: lectura.estado, medido_en: lectura.medido_en }
      : null,
    ...calcularEstado({ refrigeradora, sensor, lectura, ahora }),
  };
}

function rutasEstado(repo) {
  const r = Router();

  r.get('/', async (_req, res) => {
    const ahora = new Date();
    const [refrigeradoras, sensores] = await Promise.all([repo.listarRefrigeradoras(), repo.listarSensores()]);
    const activas = refrigeradoras.filter((ref) => ref.activa !== false);
    const items = await Promise.all(activas.map((ref) => estadoDe(repo, ref, sensores, ahora)));
    res.json({ actualizado_en: ahora.toISOString(), refrigeradoras: items });
  });

  r.get('/:id', async (req, res) => {
    const ref = await repo.obtenerRefrigeradora(req.params.id);
    if (!ref) throw new ErrorNoEncontrado('La refrigeradora no existe.');
    const sensores = await repo.listarSensores();
    res.json(await estadoDe(repo, ref, sensores, new Date()));
  });

  return r;
}

module.exports = { rutasEstado };
