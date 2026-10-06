// Rutas de refrigeradoras (HU21). La configuración de alertas (HU11) se agrega en la rama MF-16.
const { Router } = require('express');
const { validarRefrigeradora, estadoCalibracion } = require('../validacion/inventario');
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

  return r;
}

module.exports = { rutasRefrigeradoras };
