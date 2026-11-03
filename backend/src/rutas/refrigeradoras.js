// Rutas de refrigeradoras (HU21) y de su configuración de alertas (HU11).
const { Router } = require('express');
const { validarRefrigeradora, estadoCalibracion } = require('../validacion/inventario');
const { validarConfiguracion } = require('../validacion/configuracion');
const { autorizar } = require('../middleware/autorizacion');
const { ErrorNoEncontrado } = require('../errores');

function rutasRefrigeradoras(repo) {
  const r = Router();

  // GET /api/refrigeradoras → lista con su sensor y el estado de la calibración
  r.get('/', async (_req, res) => {
    const [refrigeradoras, sensores] = await Promise.all([repo.listarRefrigeradoras(), repo.listarSensores()]);
    const resultado = refrigeradoras.map((ref) => {
      const sensor = sensores.find((s) => s.refrigeradora_id === ref.id) || null;
      return { ...ref, sensor, estado_calibracion: estadoCalibracion(sensor?.vence_calibracion) };
    });
    res.json(resultado);
  });

  r.get('/:id', async (req, res) => {
    const ref = await repo.obtenerRefrigeradora(req.params.id);
    if (!ref) throw new ErrorNoEncontrado('La refrigeradora no existe.');
    res.json(ref);
  });

  // POST /api/refrigeradoras (HU21-1) – solo administrador
  r.post('/', autorizar(['administrador']), async (req, res) => {
    const v = validarRefrigeradora(req.body);
    if (!v.valido) return res.status(400).json({ errores: v.errores });
    const creada = await repo.crearRefrigeradora(v.valor);
    res.status(201).json(creada);
  });

  // PUT /api/refrigeradoras/:id → editar nombre/ubicación o desactivar (HU21-1)
  r.put('/:id', autorizar(['administrador']), async (req, res) => {
    const v = validarRefrigeradora(req.body, { parcial: true });
    if (!v.valido) return res.status(400).json({ errores: v.errores });
    res.json(await repo.actualizarRefrigeradora(req.params.id, v.valor));
  });

  // GET /api/refrigeradoras/:id/configuracion (HU11)
  r.get('/:id/configuracion', async (req, res) => {
    const ref = await repo.obtenerRefrigeradora(req.params.id);
    if (!ref) throw new ErrorNoEncontrado('La refrigeradora no existe.');
    res.json({ temp_min: Number(ref.temp_min), temp_max: Number(ref.temp_max), tolerancia_min: ref.tolerancia_min });
  });

  // PUT /api/refrigeradoras/:id/configuracion (HU11-1 y HU11-2)
  r.put('/:id/configuracion', autorizar(['administrador', 'directora_tecnica']), async (req, res) => {
    const v = validarConfiguracion(req.body);
    if (!v.valido) return res.status(400).json({ errores: v.errores });
    const ref = await repo.obtenerRefrigeradora(req.params.id);
    if (!ref) throw new ErrorNoEncontrado('La refrigeradora no existe.');
    const actualizada = await repo.actualizarRefrigeradora(req.params.id, v.valor);
    res.json({ temp_min: Number(actualizada.temp_min), temp_max: Number(actualizada.temp_max), tolerancia_min: actualizada.tolerancia_min });
  });

  return r;
}

module.exports = { rutasRefrigeradoras };
