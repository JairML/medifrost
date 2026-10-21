# Backend MediFrost

API REST y motor de alertas (Node.js + Express) conectado a Supabase.

- El ESP32 envía cada lectura por **HTTPS directo a Supabase** (tabla `lectura`, solo INSERT).
- Este backend usa la **secret key / service_role** (en `.env`, nunca en GitHub) para leer y administrar los datos.
- Las alertas se envían por **correo electrónico** (Sprint 2).

## Cómo ejecutarlo

```bash
npm install
cp .env.example .env   # completar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
npm run dev            # http://localhost:3000/api/salud → {"estado":"ok"}
npm run demo           # sin Supabase (datos en memoria)
npm test               # pruebas automáticas
```

## Alertas (Sprint 2 · HU12, HU13, HU04)

El **vigilante** revisa cada 30 s (`ALERTAS_INTERVALO_S`) cada refrigeradora activa con sensor:

| Regla | Cuándo avisa | Repetición | Cierre |
|---|---|---|---|
| Temperatura (HU12) | Fuera de rango durante la tolerancia (15 min por defecto) | Cada 30 min hasta que alguien la marque como **atendida** | Al volver al rango → aviso de normalización |
| Sin señal (HU13) | 10 min sin lecturas | Cada 30 min hasta que la atiendan | Al volver los datos → «señal recuperada» |
| Energía (HU04) | Eventos `corte_energia` y `bateria_baja` que envía el nodo a la tabla `evento_nodo` | — | `energia_restaurada` |

| Ruta | Qué hace |
|---|---|
| `GET /api/alertas` | Historial (`?abiertas=1` solo las abiertas, `?refrigeradora_id=`, `?limite=`) |
| `POST /api/alertas/:id/atender` | Marca la alerta como atendida (deja de repetirse) |
| `GET /api/estado` | Ahora incluye `alertas` abiertas y la energía del nodo (`alimentacion`, `bateria_pct`) |

Correo: Gmail con contraseña de aplicación (`SMTP_USER`, `SMTP_PASS`, `ALERTA_DESTINATARIOS`). Sin esos datos las alertas solo se escriben en la consola. Para probar la configuración, usa `npm run probar-correo`.

**Modo demo** (`npm run demo`), para probar sin hardware:

```bash
curl -X POST localhost:3000/api/demo/temperatura -H "Content-Type: application/json" -d "{\"dispositivo_id\":\"MF-NODO-01\",\"temperatura\":9.5}"
curl -X POST localhost:3000/api/demo/normal   -H "Content-Type: application/json" -d "{\"dispositivo_id\":\"MF-NODO-01\"}"
curl -X POST localhost:3000/api/demo/pausar   -H "Content-Type: application/json" -d "{\"dispositivo_id\":\"MF-NODO-01\"}"
curl -X POST localhost:3000/api/demo/evento   -H "Content-Type: application/json" -d "{\"dispositivo_id\":\"MF-NODO-01\",\"tipo\":\"corte_energia\",\"bateria_pct\":70}"
```
