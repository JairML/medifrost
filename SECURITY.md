# Política de seguridad – MediFrost

## Cómo reportar una vulnerabilidad
Escribe a **medifrost.alertas@gmail.com** con el asunto «Seguridad MediFrost». No abras un *issue* público
con detalles que permitan aprovecharla. Respondemos en un máximo de 3 días hábiles.

## Controles automáticos (DevSecOps · HU24)
| Etapa | Control | Herramienta | ¿Bloquea el PR? |
|---|---|---|---|
| Código | Análisis estático de calidad y seguridad | SonarQube Cloud (Quality Gate) | Sí |
| Código | Análisis estático de seguridad (SAST) | Semgrep (reglas JavaScript, Node, React, secretos) | Sí, severidad ERROR |
| Código | Claves o contraseñas en el historial de Git | Gitleaks | Sí |
| Dependencias | Vulnerabilidades conocidas | `npm audit --omit=dev --audit-level=high` | Sí, altas y críticas |
| Dependencias | Actualizaciones de seguridad | Dependabot (semanal, PR hacia develop) | — |
| Dependencias | Inventario de componentes (SBOM, SPDX) | Syft | No (artefacto) |
| Pruebas | 150+ pruebas automáticas | Jest + Supertest, Unity (firmware) | Sí |
| Revisión | PR revisado y aprobado por otro integrante | Ruleset de GitHub | Sí |
| Operación | Respaldo semanal cifrado (AES-256) | GitHub Actions + GPG | — |
| Operación | Disponibilidad cada 5 min | UptimeRobot | — |

## Manejo de secretos
- Ninguna clave se guarda en el repositorio: `.env` y `config.h` están en `.gitignore`; solo se versionan los `*.example`.
- En la nube, las claves viven en las variables de Render y Vercel y en GitHub Secrets.
- El ESP32 solo lleva la clave **publicable** de Supabase; por RLS únicamente puede insertar lecturas y eventos.
- Si una clave se expone, se rota de inmediato (contingencia del riesgo R02).
