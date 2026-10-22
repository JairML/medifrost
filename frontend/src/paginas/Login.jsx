// HU20 – Iniciar sesión con correo y contraseña. Tarea T30 – Mateo Andrade.
// Muestra los mensajes del backend: credenciales incorrectas (con los intentos que quedan)
// y el bloqueo de 5 minutos tras 5 intentos fallidos.
import { useEffect, useState } from 'react';
import { api, iniciarSesion } from '../api.js';

export default function Login({ onIngreso, aviso }) {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [modoDemo, setModoDemo] = useState(false);

  useEffect(() => {
    api.salud().then((s) => setModoDemo(s.modo === 'demo')).catch(() => {});
  }, []);

  async function ingresar(e) {
    e.preventDefault();
    setError(null);
    if (!correo.trim() || !contrasena) {
      setError({ texto: 'Escribe tu correo y tu contraseña.' });
      return;
    }
    setEnviando(true);
    try {
      const sesion = await iniciarSesion(correo.trim(), contrasena);
      onIngreso(sesion);
    } catch (err) {
      setError({ texto: err.message, bloqueado: err.status === 423 });
      setContrasena('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login">
      <form className="login-tarjeta" onSubmit={ingresar} noValidate>
        <div className="marca">
          <span className="logo" aria-hidden="true">❄</span>
          <div>
            <h1>MediFrost</h1>
            <p>Cadena de frío de medicamentos</p>
          </div>
        </div>

        <h2>Iniciar sesión</h2>
        {aviso && <p className="mensaje aviso" role="status">{aviso}</p>}

        <label htmlFor="login-correo">Correo
          <input id="login-correo" type="email" autoComplete="username" value={correo}
            onChange={(e) => setCorreo(e.target.value)} placeholder="nombre@botica.pe" autoFocus />
        </label>
        <label htmlFor="login-contrasena">Contraseña
          <input id="login-contrasena" type="password" autoComplete="current-password" value={contrasena}
            onChange={(e) => setContrasena(e.target.value)} />
        </label>

        {error && <p className={`mensaje ${error.bloqueado ? 'aviso' : 'error'}`} role="alert">{error.texto}</p>}

        <button type="submit" disabled={enviando}>{enviando ? 'Ingresando…' : 'Ingresar'}</button>

        {modoDemo && (
          <p className="nota login-demo">
            <strong>Modo demo.</strong> Usuarios de prueba: <code>admin@medifrost.demo</code>, <code>dt@medifrost.demo</code> o{' '}
            <code>tecnico@medifrost.demo</code>, con la contraseña <code>MediFrost2026</code>.
          </p>
        )}
      </form>
    </div>
  );
}
