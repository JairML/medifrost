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
