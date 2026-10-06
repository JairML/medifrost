// HU21 – Registrar refrigeradoras y sensores con datos de calibración.
// Tarea T14 – Mateo Andrade
import { useEffect, useState } from 'react';
import { api } from '../api.js';

const ETIQUETA_CALIBRACION = {
  vigente: { texto: 'Calibración vigente', clase: 'ok' },
  por_vencer: { texto: 'Vence en menos de 30 días', clase: 'aviso' },
  vencida: { texto: 'Calibración vencida', clase: 'error' },
  sin_datos: { texto: 'Sin datos de calibración', clase: 'neutro' },
};

const SENSOR_VACIO = { codigo: '', dispositivo_id: '', fecha_calibracion: '', vence_calibracion: '', nro_certificado: '' };

export default function Refrigeradoras({ rol }) {
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState(null);
  const [nueva, setNueva] = useState({ nombre: '', ubicacion: '' });
  const [sensorPara, setSensorPara] = useState(null);   // refrigeradora a la que se agrega o edita el sensor
  const [sensor, setSensor] = useState(SENSOR_VACIO);
  const esAdmin = rol === 'administrador';

  async function cargar() {
    setCargando(true);
    try {
      setLista(await api.listarRefrigeradoras());
    } catch (e) {
      setMensaje({ tipo: 'error', texto: e.message });
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  async function crearRefrigeradora(e) {
    e.preventDefault();
    try {
      await api.crearRefrigeradora(nueva);
      setNueva({ nombre: '', ubicacion: '' });
      setMensaje({ tipo: 'ok', texto: 'Refrigeradora registrada.' });
      cargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  }

  async function cambiarEstado(ref) {
    try {
      await api.actualizarRefrigeradora(ref.id, { activa: !ref.activa });
      setMensaje({ tipo: 'ok', texto: ref.activa ? 'Refrigeradora desactivada.' : 'Refrigeradora activada.' });
      cargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  }

  function abrirSensor(ref) {
    setSensorPara(ref);
    setSensor(ref.sensor ? {
      codigo: ref.sensor.codigo || '',
      dispositivo_id: ref.sensor.dispositivo_id || '',
      fecha_calibracion: ref.sensor.fecha_calibracion || '',
      vence_calibracion: ref.sensor.vence_calibracion || '',
      nro_certificado: ref.sensor.nro_certificado || '',
    } : SENSOR_VACIO);
  }

  async function guardarSensor(e) {
    e.preventDefault();
    const datos = { ...sensor, refrigeradora_id: sensorPara.id };
    try {
      if (sensorPara.sensor) await api.actualizarSensor(sensorPara.sensor.id, datos);
      else await api.crearSensor(datos);
      setMensaje({ tipo: 'ok', texto: `Sensor guardado en «${sensorPara.nombre}».` });
      setSensorPara(null);
      cargar();
    } catch (err) {
      setMensaje({ tipo: 'error', texto: err.message });
    }
  }

  const campoSensor = (clave) => ({
    id: `sensor-${clave}`,
    value: sensor[clave],
    onChange: (e) => setSensor({ ...sensor, [clave]: e.target.value }),
  });

  return (
    <section className="pagina">
      <h2>Refrigeradoras y sensores</h2>
      {mensaje && <p className={`mensaje ${mensaje.tipo}`} role="status">{mensaje.texto}</p>}

      {esAdmin ? (
        <form className="tarjeta formulario" onSubmit={crearRefrigeradora}>
          <h3>Nueva refrigeradora</h3>
          <div className="fila">
            <label htmlFor="ref-nombre">Nombre
              <input id="ref-nombre" required maxLength={80} value={nueva.nombre}
                onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} placeholder="Refrigeradora principal" />
            </label>
            <label htmlFor="ref-ubicacion">Ubicación
              <input id="ref-ubicacion" value={nueva.ubicacion}
                onChange={(e) => setNueva({ ...nueva, ubicacion: e.target.value })} placeholder="Mostrador" />
            </label>
          </div>
          <button type="submit">Registrar refrigeradora</button>
        </form>
      ) : (
        <p className="nota">Solo el administrador puede registrar o editar refrigeradoras y sensores.</p>
      )}

      {cargando ? <p className="nota">Cargando…</p> : lista.length === 0 ? (
        <p className="nota">Todavía no hay refrigeradoras registradas.</p>
      ) : (
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr><th>Refrigeradora</th><th>Rango</th><th>Sensor</th><th>Calibración</th><th>Estado</th>{esAdmin && <th>Acciones</th>}</tr>
            </thead>
            <tbody>
              {lista.map((ref) => {
                const cal = ETIQUETA_CALIBRACION[ref.estado_calibracion] || ETIQUETA_CALIBRACION.sin_datos;
                return (
                  <tr key={ref.id} className={ref.activa ? '' : 'inactiva'}>
                    <td><strong>{ref.nombre}</strong><br /><small>{ref.ubicacion || '—'}</small></td>
                    <td className="num">{Number(ref.temp_min).toFixed(1)} – {Number(ref.temp_max).toFixed(1)} °C<br /><small>tolerancia {ref.tolerancia_min} min</small></td>
                    <td>{ref.sensor ? <>{ref.sensor.codigo}<br /><small>{ref.sensor.dispositivo_id}</small></> : <small>Sin sensor</small>}</td>
                    <td>
                      <span className={`chip ${cal.clase}`}>{cal.texto}</span>
                      {ref.sensor?.vence_calibracion && <><br /><small>vence {ref.sensor.vence_calibracion}</small></>}
                    </td>
                    <td>{ref.activa ? 'Activa' : 'Desactivada'}</td>
                    {esAdmin && (
                      <td className="acciones">
                        <button type="button" className="secundario" onClick={() => abrirSensor(ref)}>
                          {ref.sensor ? 'Editar sensor' : 'Agregar sensor'}
                        </button>
                        <button type="button" className="secundario" onClick={() => cambiarEstado(ref)}>
                          {ref.activa ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {sensorPara && (
        <form className="tarjeta formulario" onSubmit={guardarSensor}>
          <h3>Sensor de «{sensorPara.nombre}»</h3>
          <div className="fila">
            <label htmlFor="sensor-codigo">Código del sensor<input required {...campoSensor('codigo')} placeholder="DS18B20-001" /></label>
            <label htmlFor="sensor-dispositivo_id">ID del dispositivo<input required {...campoSensor('dispositivo_id')} placeholder="MF-NODO-01" /></label>
          </div>
          <div className="fila">
            <label htmlFor="sensor-fecha_calibracion">Fecha de calibración<input type="date" {...campoSensor('fecha_calibracion')} /></label>
            <label htmlFor="sensor-vence_calibracion">Vence<input type="date" {...campoSensor('vence_calibracion')} /></label>
            <label htmlFor="sensor-nro_certificado">N.° de certificado<input {...campoSensor('nro_certificado')} placeholder="LAB-2026-0123" /></label>
          </div>
          <div className="botones">
            <button type="submit">Guardar sensor</button>
            <button type="button" className="secundario" onClick={() => setSensorPara(null)}>Cancelar</button>
          </div>
        </form>
      )}
    </section>
  );
}
