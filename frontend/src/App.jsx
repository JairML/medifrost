import { useEffect, useState } from 'react';
import { sesionActual, cerrarSesion, alExpirarSesion } from './api.js';
import Login from './paginas/Login.jsx';
import Refrigeradoras from './paginas/Refrigeradoras.jsx';
import Configuracion from './paginas/Configuracion.jsx';
import Estado from './paginas/Estado.jsx';
import Alertas from './paginas/Alertas.jsx';

// HU20 (T30 – Mateo Andrade): el rol ya no se elige en una lista, viene de la sesión iniciada.
const ETIQUETA_ROL = {
  administrador: 'Administrador',
  directora_tecnica: 'Directora Técnica',
  tecnico: 'Técnico de farmacia',
};

export default function App() {
  const [sesion, setSesion] = useState(sesionActual());
  const [aviso, setAviso] = useState(null);
  const [pagina, setPagina] = useState('estado');

  useEffect(() => {
    alExpirarSesion((mensaje) => {
      setSesion(null);
      setAviso(mensaje || 'Tu sesión expiró. Vuelve a iniciar sesión.');
    });
  }, []);

  if (!sesion) {
    return <Login aviso={aviso} onIngreso={(s) => { setAviso(null); setPagina('estado'); setSesion(s); }} />;
  }

  const { usuario } = sesion;
  const rol = usuario.rol;

  function salir() {
    cerrarSesion();
    setAviso(null);
    setSesion(null);
  }

  return (
    <div className="app">
      <header className="cabecera">
        <div className="marca">
          <span className="logo" aria-hidden="true">❄</span>
          <div>
            <h1>MediFrost</h1>
            <p>Cadena de frío de medicamentos · 2 °C a 8 °C</p>
          </div>
        </div>
        <div className="usuario">
          <div>
            <strong>{usuario.nombre}</strong>
            <span>{ETIQUETA_ROL[rol] || rol}</span>
          </div>
          <button type="button" className="secundario" onClick={salir}>Cerrar sesión</button>
        </div>
      </header>

      <nav className="pestanas" aria-label="Secciones">
        <button className={pagina === 'estado' ? 'activa' : ''} onClick={() => setPagina('estado')}>
          Estado actual
        </button>
        <button className={pagina === 'alertas' ? 'activa' : ''} onClick={() => setPagina('alertas')}>
          Alertas
        </button>
        <button className={pagina === 'refrigeradoras' ? 'activa' : ''} onClick={() => setPagina('refrigeradoras')}>
          Refrigeradoras y sensores
        </button>
        <button className={pagina === 'configuracion' ? 'activa' : ''} onClick={() => setPagina('configuracion')}>
          Rango y tolerancia
        </button>
      </nav>

      <main>
        {pagina === 'estado' && <Estado />}
        {pagina === 'alertas' && <Alertas />}
        {pagina === 'refrigeradoras' && <Refrigeradoras rol={rol} />}
        {pagina === 'configuracion' && <Configuracion rol={rol} />}
      </main>

      <footer className="pie">
        MediFrost · Proyecto Integrador – Calidad de Software · Universidad ESAN · Sprint 2
      </footer>
    </div>
  );
}
