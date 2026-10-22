// HU06 – Ver en el dashboard la temperatura actual y el estado de cada refrigeradora.
// Tarea T10 – Mateo Andrade
// Criterios: última temperatura + hora + color (verde/rojo/gris) · se actualiza sola cada ≤ 60 s.
// Sprint 2 – Tareas T21 y T24 (Mateo Andrade): aviso de alerta en la tarjeta, botón
// «Marcar como atendida» (HU12-2), estado «sin señal» con su alerta (HU13) y energía del nodo (HU04).
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { TIPOS, detalleAlerta } from '../alertas.js';

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

// Aviso de una alerta abierta dentro de la tarjeta (HU12 / HU13 / HU04)
function AvisoAlerta({ alerta, onAtender }) {
  const t = TIPOS[alerta.tipo] || TIPOS.temperatura;
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  async function atender() {
    setEnviando(true);
    setError(null);
    try {
      await onAtender(alerta.id);
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  }

  return (
    <div className={`aviso-alerta ${t.clase} ${alerta.estado}`} role="status">
      <p className="aviso-titulo"><span aria-hidden="true">{t.icono}</span> {t.etiqueta}</p>
      <p className="aviso-detalle">{detalleAlerta(alerta)}</p>
      {alerta.estado === 'activa' ? (
        <>
          <p className="aviso-detalle">
            Aviso enviado a las {hora(alerta.notificada_en)} · {alerta.envios} {alerta.envios === 1 ? 'correo' : 'correos'}
          </p>
          <button type="button" onClick={atender} disabled={enviando}>
            {enviando ? 'Guardando…' : 'Marcar como atendida'}
          </button>
        </>
      ) : (
        <p className="aviso-detalle">✔ Atendida por {alerta.atendida_por} ({hora(alerta.atendida_en)}). Se avisará cuando se normalice.</p>
      )}
      {error && <p className="aviso-detalle aviso-error" role="alert">{error}</p>}
    </div>
  );
}

function textoEnergia(lectura) {
  if (!lectura || !lectura.alimentacion) return null;
  if (lectura.alimentacion === 'bateria') return `🔋 Batería ${lectura.bateria_pct ?? '—'} % (sin energía externa)`;
  return `🔌 Energía externa${lectura.bateria_pct !== null && lectura.bateria_pct !== undefined ? ` · batería ${lectura.bateria_pct} %` : ''}`;
}

function TarjetaEstado({ item, onAtender }) {
  const e = ESTADOS[item.estado] || ESTADOS.sin_senal;
  const { refrigeradora: r, lectura, sensor } = item;
  const temperatura = lectura && lectura.temperatura !== null ? lectura.temperatura.toFixed(1) : '—';
  const alertas = item.alertas || [];
  const energia = textoEnergia(lectura);

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

      {alertas.map((a) => <AvisoAlerta key={a.id} alerta={a} onAtender={onAtender} />)}

      <dl className="estado-datos">
        <div><dt>Rango</dt><dd>{r.temp_min} – {r.temp_max} °C</dd></div>
        <div>
          <dt>Última lectura</dt>
          <dd>{lectura ? <>{hora(lectura.medido_en)} <small>({hace(item.minutos_desde_lectura)})</small></> : 'Sin lecturas'}</dd>
        </div>
        <div><dt>Sensor</dt><dd>{sensor ? `${sensor.codigo} · ${sensor.dispositivo_id}` : 'No vinculado'}</dd></div>
        {energia && <div><dt>Energía del nodo</dt><dd>{energia}</dd></div>}
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

  // HU12-2: al marcarla como atendida deja de repetirse el correo
  const atender = useCallback(async (id) => {
    await api.atenderAlerta(id);
    await actualizar();
  }, [actualizar]);

  const lista = datos?.refrigeradoras || [];
  const alertasActivas = lista.reduce((n, x) => n + (x.alertas || []).filter((a) => a.estado === 'activa').length, 0);
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
          {alertasActivas > 0 && <span className="estado-chip alerta">🔔 {alertasActivas} {alertasActivas === 1 ? 'alerta por atender' : 'alertas por atender'}</span>}
        </p>
      )}

      {datos && lista.length === 0 && (
        <p className="nota">Todavía no hay refrigeradoras activas. Regístralas en «Refrigeradoras y sensores».</p>
      )}

      <div className="estado-grilla">
        {lista.map((item) => <TarjetaEstado key={item.refrigeradora.id} item={item} onAtender={atender} />)}
      </div>
    </section>
  );
}
