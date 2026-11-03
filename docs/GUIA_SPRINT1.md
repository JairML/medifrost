# Guía del Sprint 1 – Implementación para el avance del viernes 9

**Sprint 1:** lunes 05/10 al viernes 16/10/2026 · **Sprint Goal:** «Ver en el dashboard web la temperatura real de la refrigeradora, medida por el nodo MediFrost y almacenada en la nube.»

Para el avance del viernes 9 se muestran funcionando **dos requerimientos funcionales completos** (indicador 4 de la rúbrica):

| Requerimiento | Historia | Qué se demuestra |
|---|---|---|
| **RF02**: alertar si la temperatura sale de 2–8 °C más de 15 min (tiempo configurable) | HU11 (MF-16) | Configurar rango y tolerancia; el sistema rechaza mínimo ≥ máximo y tolerancias fuera de 1–60 min; solo la DT o el administrador pueden cambiarlo |
| **RF08**: reporte con identificación y calibración del sensor | HU21 (MF-26) | Registrar refrigeradoras y sensores con su certificado; aviso de calibración vigente / por vencer / vencida; un dispositivo no puede vincularse dos veces |
| *Plus* **RF01**: lectura automática | HU01 (MF-6) | ESP32 en el simulador Wokwi leyendo la temperatura cada 60 s |

## Orden de integración (cada paquete depende del anterior)

| # | Día | Quién | Rama | Revisa | Qué agrega |
|---|---|---|---|---|---|
| 1 | Lun 5 | Ian | `feature/MF-26-base-datos` | Jair | Esquema SQL en Supabase |
| 2 | Lun 5 | Jair | `feature/MF-7-backend-base` | Ian | Servidor Express, conexión a Supabase, README |
| 3 | Mar 6 | Domenico | `feature/MF-26-api-refrigeradoras-sensores` | Kheyla | API de HU21 |
| 4 | Mar 6 | Ian | `feature/MF-16-api-rango-tolerancia` | Mateo | API de HU11 |
| 5 | Mié 7 | Mateo | `feature/MF-26-pantallas-refrigeradoras` | Domenico | Frontend: refrigeradoras y sensores |
| 6 | Mié 7 | Domenico | `feature/MF-16-pantalla-rango-tolerancia` | Mateo | Frontend: rango y tolerancia |
| 7 | Jue 8 | Domenico | `feature/MF-6-firmware-lectura` | Kheyla | Firmware ESP32 + Wokwi |
| 8 | Jue 8 | Kheyla | `feature/MF-26-pruebas-y-ci` | Jair | 51 pruebas backend, 8 de firmware y GitHub Actions |

Regla: **cada rama se crea desde `develop` actualizado** (`git checkout develop && git pull`) después de que se integró la anterior. Así no hay conflictos.

## Primera vez con Git (cada integrante)

```bash
git clone https://github.com/JairML/medifrost.git
cd medifrost
git checkout develop
```

Si no usan la terminal, GitHub Desktop o la pestaña «Control de código fuente» de VS Code hacen lo mismo.

## Evidencias que se toman esta semana (para el documento final)

| Evidencia | Quién | Sección |
|---|---|---|
| Captura del Burndown (lun, mié, vie) | Jair | 2.3 MC |
| Registro de cada Daily (3 preguntas e impedimentos) | Jair | 2.3 MC |
| Captura de cada Pull Request aprobado | Quien lo abrió | 2.4 CM |
| Captura de las tablas en Supabase | Ian | 2.8 II |
| Resultado de `npm test` y check verde de GitHub Actions | Kheyla | 2.5 PQA |
| Video o capturas de Wokwi | Domenico | Demo |

## Demo del viernes (≈ 2 minutos, la hace Domenico)

1. Encender el backend (`npm run dev`, o `npm run demo` como respaldo sin internet) y el frontend (`npm run dev`).
2. **HU21:** registrar «Refrigeradora principal» → agregar el sensor DS18B20-001 / MF-NODO-01 con un vencimiento cercano → aparece «Vence en menos de 30 días».
3. Intentar registrar otro sensor con el mismo dispositivo → el sistema lo rechaza.
4. **HU11:** en «Rango y tolerancia», poner mínimo 8 y máximo 2 → mensaje de error. Poner 2 – 8 °C y 15 min → «Configuración guardada».
5. Cambiar el usuario a «Técnico de farmacia» → ya no puede editar.
6. **Plus:** mostrar el ESP32 en Wokwi imprimiendo la temperatura y cambiarla con un clic.
7. Mostrar en GitHub los Pull Requests aprobados y el check verde de las pruebas.
