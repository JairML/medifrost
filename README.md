# MediFrost

Sistema IoT de monitoreo continuo de temperatura para la cadena de frío de medicamentos en boticas.
Proyecto Integrador – Calidad de Software – Universidad ESAN.

| Carpeta | Contenido | Tecnología |
|---|---|---|
| `supabase/` | Esquema de la base de datos y políticas de seguridad | PostgreSQL (Supabase) |
| `backend/` | API REST: refrigeradoras, sensores, configuración de alertas | Node.js 22 + Express 5 |
| `frontend/` | Dashboard web | React 18 + Vite 6 |
| `firmware/` | Nodo ESP32 + sensor DS18B20 (y proyecto para el simulador Wokwi) | C++ / PlatformIO |
| `docs/` | Guías y evidencias del proyecto | — |

## Avance del Sprint 1 (05/10 – 16/10/2026)

| Historia | Requerimiento | Estado |
|---|---|---|
| HU21 – Registrar refrigeradoras y sensores con calibración | RF08, RNF04 | API + pantalla + pruebas |
| HU11 – Configurar rango y tolerancia | RF02 | API + pantalla + pruebas |
| HU01 – Medir la temperatura cada 60 s | RF01 | Firmware + pruebas (simulador Wokwi) |

## Cómo ejecutarlo en tu computadora

Requisitos: Node.js 22 o superior.

```bash
# 1. Backend (en una terminal)
cd backend
npm install
cp .env.example .env      # completar SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
npm run dev               # http://localhost:3000/api/salud
#   Sin Supabase: npm run demo  (usa datos en memoria)

# 2. Frontend (en otra terminal)
cd frontend
npm install
npm run dev               # http://localhost:5173
```

### Pruebas

```bash
cd backend && npm test               # 51 pruebas (Jest), con reporte de cobertura
cd firmware && pio test -e native    # 8 pruebas del firmware (Unity), sin placa
```

## Flujo de trabajo (GitFlow)

1. Crear la rama desde `develop`: `feature/MF-<n>-<descripcion>` (MF-n es la clave de Jira).
2. Hacer commits que mencionen la clave: `MF-26 Agrega API de sensores`.
3. Abrir un Pull Request hacia `develop`; otro integrante lo revisa y aprueba.
4. Al cierre de cada sprint, `develop` se integra en `main` y se crea el tag `v0.x-SprintN`.

Las claves (`.env`) **nunca** se suben al repositorio.
