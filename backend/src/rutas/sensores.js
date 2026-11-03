// Rutas de sensores y datos de calibración (HU21).
const { Router } = require('express');
const { validarSensor, estadoCalibracion } = require('../validacion/inventario');
const { autorizar } = require('../middleware/autorizacion');
const { ErrorNoEncontrado } = require('../errores');

function rutasSensores(repo) {
  const r = Router();

  r.get('/', async (_req, res) => {
    const sensores = await repo.listarSensores();
    res.json(sensores.map((s) => ({ ...s, estado_calibracion: estadoCalibracion(s.vence_calibracion) })));
  });

  // POST /api/sensores (HU21-1, HU21-2: un dispositivo no puede vincularse a dos refrigeradoras)
  r.post('/', autorizar(['administrador']), async (req, res) => {
    const v = validarSensor(req.body);
    if (!v.valido) return res.status(400).json({ errores: v.errores });
    const creado = await repo.crearSensor(v.valor);
    res.status(201).json({ ...creado, estado_calibracion: estadoCalibracion(creado.vence_calibracion) });
  });

  r.put('/:id', autorizar(['administrador']), async (req, res) => {
    const v = validarSensor(req.body);
    if (!v.valido) return res.status(400).json({ errores: v.errores });
    const existente = await repo.obtenerSensor(req.params.id);
    if (!existente) throw new ErrorNoEncontrado('El sensor no existe.');
    const actualizado = await repo.actualizarSensor(req.params.id, v.valor);
    res.json({ ...actualizado, estado_calibracion: estadoCalibracion(actualizado.vence_calibracion) });
  });

  return r;
}

module.exports = { rutasSensores };
