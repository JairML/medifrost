// Rutas de alertas (HU12, HU13, HU04). Tarea T19 – Jair Menéndez.
// GET  /api/alertas                     → historial (más recientes primero)
//        ?abiertas=1                    → solo las que están activas o atendidas
//        ?refrigeradora_id=…  ?limite=…
// POST /api/alertas/:id/atender         → HU12-2: marcarla como «atendida» (deja de repetirse)
const { Router } = require('express');
const { ErrorNoEncontrado, ErrorConflicto } = require('../errores');

const ETIQUETA_ROL = { administrador: 'Administrador', directora_tecnica: 'Directora Técnica', tecnico: 'Técnico de farmacia' };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function quien(usuario) {
  if (!usuario) return 'Usuario';
  return usuario.nombre || ETIQUETA_ROL[usuario.rol] || usuario.rol || 'Usuario';
}

function rutasAlertas(repo, { reloj = () => new Date() } = {}) {
  const r = Router();

  r.get('/', async (req, res) => {
    const abiertas = ['1', 'true', 'si'].includes(String(req.query.abiertas || '').toLowerCase());
    const todas = ['1', 'true', 'si'].includes(String(req.query.todas || '').toLowerCase());
    const limite = Math.min(Math.max(Number(req.query.limite) || 50, 1), 200);
    const refrigeradoraId = req.query.refrigeradora_id ? String(req.query.refrigeradora_id) : null;
    if (refrigeradoraId && !UUID.test(refrigeradoraId)) return res.status(400).json({ errores: ['refrigeradora_id no es válido.'] });

    let estados = ['activa', 'atendida', 'cerrada']; // el historial no muestra las «pendientes» ni las «descartadas»
    if (abiertas) estados = ['activa', 'atendida'];
    if (todas) estados = null;

    const [alertas, refrigeradoras] = await Promise.all([
      repo.listarAlertas({ estados, refrigeradoraId, limite }),
      repo.listarRefrigeradoras(),
    ]);
    const nombres = Object.fromEntries(refrigeradoras.map((x) => [x.id, x.nombre]));
    res.json(alertas.map((a) => ({ ...a, refrigeradora_nombre: nombres[a.refrigeradora_id] || '—' })));
  });

  r.post('/:id/atender', async (req, res) => {
    if (!UUID.test(req.params.id)) throw new ErrorNoEncontrado('La alerta no existe.');
    const alerta = await repo.obtenerAlerta(req.params.id);
    if (!alerta) throw new ErrorNoEncontrado('La alerta no existe.');
    if (alerta.estado === 'atendida') throw new ErrorConflicto(`La alerta ya fue atendida por ${alerta.atendida_por}.`);
    if (alerta.estado !== 'activa') throw new ErrorConflicto('La alerta ya está cerrada.');

    const actualizada = await repo.actualizarAlerta(alerta.id, {
      estado: 'atendida',
      atendida_en: reloj().toISOString(),
      atendida_por: quien(req.usuario),
    });
    res.json(actualizada);
  });

  return r;
}

module.exports = { rutasAlertas };
