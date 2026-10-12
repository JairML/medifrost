// HU06 – Ver en el dashboard la temperatura actual y el estado de cada refrigeradora.
// Tarea T10 – Mateo Andrade
// Criterios: última temperatura + hora + color (verde/rojo/gris) · se actualiza sola cada ≤ 60 s.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';

const INTERVALO_MS = 30000; // cada 30 s (el criterio pide al menos cada 60 s)

const ESTADOS = {
  normal: { etiqueta: 'Normal', clase: 'normal' },
  alerta: { etiqueta: 'Alerta', clase: 'alerta' },
  sin_senal: { etiqueta: 'Sin señal', clase: 'sin-senal' },
  sin_sensor: { etiqueta: 'Sin sensor', clase: 'sin-senal' },
};

const hora = (iso) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
const horaSeg = (iso) => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

function hace(minutos) {
  if (minutos === null || minutos === undefined) return '';
  if (minutos < 1) return 'hace menos de 1 min';
  if (minutos < 60) return `hace ${minutos} min`;
  const h = Math.floor(minutos / 60);
  return `hace ${h} h ${minutos % 60} min`;
}

function TarjetaEstado({ item }) {
  const e = ESTADOS[item.estado] || ESTADOS.sin_senal;
  const { refrigeradora: r, lectura, sensor } = item;
  const temperatura = lectura && lectura.temperatura !== null ? lectura.temperatura.toFixed(1) : '—';

  return (
    <article className={`estado-tarjeta ${e.clase}`} aria-label={`${r.nombre}: ${e.etiqueta}`}>
      <header>
        <div>
          <h3>{r.nombre}</h3>
          {r.ubicacion && <p>{r.ubicacion}</p>}
        </div>
        <span className={`estado-chip ${e.clase}`}>{e.etiqueta}</span>
      </header>

      <p className="estado-temp">
        <span className="valor">{temperatura}</span>
        {temperatura !== '—' && <span className="unidad">°C</span>}
      </p>

      <p className="estado-motivo">{item.motivo}</p>

      <dl className="estado-datos">
        <div><dt>Rango</dt><dd>{r.temp_min} – {r.temp_max} °C</dd></div>
        <div>
          <dt>Última lectura</dt>
          <dd>{lectura ? <>{hora(lectura.medido_en)} <small>({hace(item.minutos_desde_lectura)})</small></> : 'Sin lecturas'}</dd>
        </div>
        <div><dt>Sensor</dt><dd>{sensor ? `${sensor.codigo} · ${sensor.dispositivo_id}` : 'No vinculado'}</dd></div>
      </dl>
    </article>
  );
}

export default function Estado() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const actualizar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await api.obtenerEstado());
      setError(null);
    } catch (e) {
      setError(e.message); // se mantienen los últimos datos en pantalla
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    actualizar();
    const id = setInterval(actualizar, INTERVALO_MS);
    return () => clearInterval(id);
  }, [actualizar]);

  const lista = datos?.refrigeradoras || [];
  const resumen = lista.reduce((acc, x) => ({ ...acc, [x.estado]: (acc[x.estado] || 0) + 1 }), {});

  return (
    <section className="pagina">
      <div className="estado-cabecera">
        <div>
          <h2>Estado actual</h2>
          <p className="nota">
            <span className={`pulso ${error ? 'caido' : ''}`} aria-hidden="true" />
            {datos ? `Actualizado a las ${horaSeg(datos.actualizado_en)} · se actualiza solo cada ${INTERVALO_MS / 1000} s` : 'Cargando…'}
          </p>
        </div>
        <button type="button" className="secundario" onClick={actualizar} disabled={cargando}>
          {cargando ? 'Actualizando…' : 'Actualizar ahora'}
        </button>
      </div>

      {error && <p className="mensaje error" role="alert">{error}</p>}

      {lista.length > 0 && (
        <p className="estado-resumen">
          <span className="estado-chip normal">{resumen.normal || 0} normal</span>
          <span className="estado-chip alerta">{resumen.alerta || 0} en alerta</span>
          <span className="estado-chip sin-senal">{(resumen.sin_senal || 0) + (resumen.sin_sensor || 0)} sin señal</span>
        </p>
      )}

      {datos && lista.length === 0 && (
        <p className="nota">Todavía no hay refrigeradoras activas. Regístralas en «Refrigeradoras y sensores».</p>
      )}

      <div className="estado-grilla">
        {lista.map((item) => <TarjetaEstado key={item.refrigeradora.id} item={item} />)}
      </div>
    </section>
  );
}
