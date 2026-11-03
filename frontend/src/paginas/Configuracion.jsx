// HU11 – Configurar rango permitido y tiempo de tolerancia (RF02).
// Tarea T17 – Domenico Chang
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { validarConfiguracion } from '../validacion.js';

export default function Configuracion({ rol }) {
  const [refrigeradoras, setRefrigeradoras] = useState([]);
  const [seleccion, setSeleccion] = useState('');
  const [form, setForm] = useState({ temp_min: '', temp_max: '', tolerancia_min: '' });
  const [errores, setErrores] = useState([]);
  const [mensaje, setMensaje] = useState(null);
  const puedeEditar = rol === 'administrador' || rol === 'directora_tecnica';

  useEffect(() => {
    api.listarRefrigeradoras()
      .then((lista) => {
        setRefrigeradoras(lista);
        if (lista.length) setSeleccion(lista[0].id);
      })
      .catch((e) => setMensaje({ tipo: 'error', texto: e.message }));
  }, []);

  useEffect(() => {
    if (!seleccion) return;
    setErrores([]);
    setMensaje(null);
    api.obtenerConfiguracion(seleccion)
      .then((c) => setForm({ temp_min: String(c.temp_min), temp_max: String(c.temp_max), tolerancia_min: String(c.tolerancia_min) }))
      .catch((e) => setMensaje({ tipo: 'error', texto: e.message }));
  }, [seleccion]);

  async function guardar(e) {
    e.preventDefault();
    setMensaje(null);
    const locales = validarConfiguracion(form);
    setErrores(locales);
    if (locales.length) return;
    try {
      const guardada = await api.guardarConfiguracion(seleccion, {
        temp_min: Number(form.temp_min), temp_max: Number(form.temp_max), tolerancia_min: Number(form.tolerancia_min),
      });
      setMensaje({ tipo: 'ok', texto: `Configuración guardada: ${guardada.temp_min} – ${guardada.temp_max} °C, alerta tras ${guardada.tolerancia_min} min fuera de rango.` });
    } catch (err) {
      setErrores(err.errores.length ? err.errores : [err.message]);
    }
  }

  const campo = (clave) => ({ id: `cfg-${clave}`, value: form[clave], disabled: !puedeEditar, onChange: (e) => setForm({ ...form, [clave]: e.target.value }) });

  if (!refrigeradoras.length) {
    return (
      <section className="pagina">
        <h2>Rango y tolerancia</h2>
        {mensaje ? <p className={`mensaje ${mensaje.tipo}`}>{mensaje.texto}</p> : <p className="nota">Primero registra una refrigeradora.</p>}
      </section>
    );
  }

  return (
    <section className="pagina">
      <h2>Rango y tolerancia</h2>
      <p className="nota">
        Rango permitido de temperatura y minutos que la lectura puede estar fuera de rango antes de enviar una alerta.
        Valores recomendados para cadena de frío: 2 °C a 8 °C y 15 minutos.
      </p>

      <form className="tarjeta formulario" onSubmit={guardar} noValidate>
        <label htmlFor="cfg-refrigeradora">Refrigeradora
          <select id="cfg-refrigeradora" value={seleccion} onChange={(e) => setSeleccion(e.target.value)}>
            {refrigeradoras.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </label>
        <div className="fila">
          <label htmlFor="cfg-temp_min">Temperatura mínima (°C)<input type="number" step="0.1" {...campo('temp_min')} /></label>
          <label htmlFor="cfg-temp_max">Temperatura máxima (°C)<input type="number" step="0.1" {...campo('temp_max')} /></label>
          <label htmlFor="cfg-tolerancia_min">Tolerancia (minutos)<input type="number" step="1" min="1" max="60" {...campo('tolerancia_min')} /></label>
        </div>
        {errores.length > 0 && (
          <ul className="mensaje error" role="alert">{errores.map((er) => <li key={er}>{er}</li>)}</ul>
        )}
        {mensaje && <p className={`mensaje ${mensaje.tipo}`} role="status">{mensaje.texto}</p>}
        {puedeEditar ? <button type="submit">Guardar configuración</button>
          : <p className="nota">Solo la Directora Técnica o el administrador pueden cambiar el rango y la tolerancia.</p>}
      </form>
    </section>
  );
}
