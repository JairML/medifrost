// Historial de alertas (HU12, HU13, HU04). Tarea T24 – Mateo Andrade.
// Sirve como registro para la Directora Técnica: qué pasó, cuándo, cuánto duró y quién lo atendió.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { TIPOS, ESTADOS_ALERTA, detalleAlerta, fechaHora } from '../alertas.js';

function duracion(a) {
  const fin = a.cerrada_en ? new Date(a.cerrada_en) : new Date();
  const min = Math.max(0, Math.round((fin - new Date(a.inicio_en)) / 60000));
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}

export default function Alertas() {
  const [alertas, setAlertas] = useState([]);
  const [soloAbiertas, setSoloAbiertas] = useState(false);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    try {
      setAlertas(await api.listarAlertas({ abiertas: soloAbiertas }));
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [soloAbiertas]);

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 60000);
    return () => clearInterval(id);
  }, [cargar]);

  async function atender(id) {
    try {
      await api.atenderAlerta(id);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className="pagina">
      <div className="estado-cabecera">
        <div>
          <h2>Historial de alertas</h2>
          <p className="nota">Cada alerta enviada por correo, con su duración y quién la atendió.</p>
        </div>
        <div className="botones">
          <label className="casilla">
            <input type="checkbox" checked={soloAbiertas} onChange={(e) => setSoloAbiertas(e.target.checked)} />
            Solo abiertas
          </label>
          <button type="button" className="secundario" onClick={cargar}>Actualizar</button>
        </div>
      </div>

      {error && <p className="mensaje error" role="alert">{error}</p>}
      {!cargando && alertas.length === 0 && !error && (
        <p className="nota">{soloAbiertas ? 'No hay alertas abiertas.' : 'Todavía no se ha enviado ninguna alerta.'}</p>
      )}

      {alertas.length > 0 && (
        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Inicio</th><th>Refrigeradora</th><th>Tipo</th><th>Detalle</th><th>Estado</th><th>Duración</th><th>Correos</th><th>Atendida por</th><th></th>
              </tr>
            </thead>
            <tbody>
              {alertas.map((a) => {
                const t = TIPOS[a.tipo] || { etiqueta: a.tipo, icono: '' };
                const e = ESTADOS_ALERTA[a.estado] || { etiqueta: a.estado, chip: 'neutro' };
                return (
                  <tr key={a.id}>
                    <td className="num">{fechaHora(a.inicio_en)}</td>
                    <td>{a.refrigeradora_nombre}</td>
                    <td><span aria-hidden="true">{t.icono}</span> {t.etiqueta}</td>
                    <td><small>{detalleAlerta(a)}</small></td>
                    <td><span className={`chip ${e.chip}`}>{e.etiqueta}</span></td>
                    <td className="num">{duracion(a)}{!a.cerrada_en && <small> (sigue)</small>}</td>
                    <td className="num">{a.envios}</td>
                    <td>{a.atendida_por ? <>{a.atendida_por}<br /><small>{fechaHora(a.atendida_en)}</small></> : <small>—</small>}</td>
                    <td>{a.estado === 'activa' && <button type="button" onClick={() => atender(a.id)}>Atender</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
