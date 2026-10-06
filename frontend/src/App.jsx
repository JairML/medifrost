import { useState } from 'react';
import { fijarRol } from './api.js';
import Refrigeradoras from './paginas/Refrigeradoras.jsx';

const ROLES = [
  { valor: 'administrador', etiqueta: 'Administrador' },
  { valor: 'directora_tecnica', etiqueta: 'Directora Técnica' },
  { valor: 'tecnico', etiqueta: 'Técnico de farmacia' },
];

export default function App() {
  const [pagina, setPagina] = useState('refrigeradoras');   // la pestaña «Rango y tolerancia» llega con HU11
  const [rol, setRol] = useState('administrador');

  function cambiarRol(e) {
    setRol(e.target.value);
    fijarRol(e.target.value);
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
        <label className="rol">
          <span>Usuario (demo)</span>
          <select id="rol" value={rol} onChange={cambiarRol}>
            {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
          </select>
        </label>
      </header>

      <nav className="pestanas" aria-label="Secciones">
        <button className={pagina === 'refrigeradoras' ? 'activa' : ''} onClick={() => setPagina('refrigeradoras')}>
          Refrigeradoras y sensores
        </button>
      </nav>

      <main>
        <Refrigeradoras rol={rol} />
      </main>

      <footer className="pie">
        MediFrost · Proyecto Integrador – Calidad de Software · Universidad ESAN · Sprint 1
      </footer>
    </div>
  );
}
