// Inicio de sesión (HU20). Tarea T29 – Domenico Chang.
// POST /api/auth/login   { correo, contrasena } → { token, usuario, expira_en }
// GET  /api/auth/yo      → datos del usuario de la sesión actual (necesita token)
const { Router } = require('express');
const { verificar, HASH_RELLENO } = require('../auth/contrasenas');
const { emitirToken, verificarToken } = require('../auth/tokens');
const bloqueo = require('../auth/bloqueo');
const { requerirSesion } = require('../middleware/autorizacion');

const CREDENCIALES_INVALIDAS = 'Correo o contraseña incorrectos.';

function rutasAuth(repo, { secreto, expiraEn, reloj = () => new Date() }) {
  const r = Router();

  r.post('/login', async (req, res) => {
    const correo = String(req.body?.correo || '').trim().toLowerCase();
    const contrasena = String(req.body?.contrasena || '');
    if (!correo || !contrasena) return res.status(400).json({ errores: ['Escribe tu correo y tu contraseña.'] });

    const ahora = reloj();
    const usuario = await repo.buscarUsuarioPorCorreo(correo);

    if (!usuario) {
      await verificar(contrasena, HASH_RELLENO); // misma demora que con un usuario real
      return res.status(401).json({ errores: [CREDENCIALES_INVALIDAS] });
    }
    if (bloqueo.estaBloqueado(usuario, ahora)) {
      const m = bloqueo.minutosRestantes(usuario, ahora);
      return res.status(423).json({ errores: [`Demasiados intentos fallidos. Vuelve a intentarlo en ${m} min.`], bloqueado_hasta: usuario.bloqueado_hasta });
    }
    if (usuario.activo === false) return res.status(403).json({ errores: ['Tu cuenta está desactivada. Habla con el administrador.'] });

    if (!(await verificar(contrasena, usuario.hash_contrasena))) {
      const cambios = bloqueo.registrarFallo(usuario, ahora);
      await repo.actualizarUsuario(usuario.id, cambios);
      if (cambios.bloqueado_hasta) {
        return res.status(423).json({
          errores: [`Demasiados intentos fallidos. La cuenta queda bloqueada ${bloqueo.MINUTOS_BLOQUEO} min.`],
          bloqueado_hasta: cambios.bloqueado_hasta,
        });
      }
      const quedan = bloqueo.MAX_INTENTOS - cambios.intentos_fallidos;
      return res.status(401).json({ errores: [`${CREDENCIALES_INVALIDAS} Te quedan ${quedan} ${quedan === 1 ? 'intento' : 'intentos'}.`] });
    }

    if (usuario.intentos_fallidos || usuario.bloqueado_hasta) await repo.actualizarUsuario(usuario.id, bloqueo.registrarExito());
    const token = emitirToken(usuario, { secreto, expiraEn, ahora });
    const { expira } = verificarToken(token, { secreto, ahora });
    res.json({
      token,
      expira_en: expira.toISOString(),
      usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
    });
  });

  r.get('/yo', requerirSesion, (req, res) => res.json(req.usuario));

  return r;
}

module.exports = { rutasAuth };
