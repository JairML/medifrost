# Firmware del nodo MediFrost (ESP32 + DS18B20)

Lee la temperatura cada 60 s (HU01) y la envía por HTTPS a la tabla `lectura` de Supabase (HU02).

| Carpeta | Para qué |
|---|---|
| `src/`, `include/`, `platformio.ini` | Proyecto PlatformIO (VS Code) |
| `arduino/medifrost_nodo/` | Mismo código para Arduino IDE |
| `wokwi/` | Mismo código para el simulador Wokwi (WiFi `Wokwi-GUEST`) |
| `test/` | Pruebas unitarias (`pio test -e native`), corren en GitHub Actions |

**Configuración:** copia `config.example.h` como `config.h` y completa WiFi, `SUPABASE_URL` y la clave **publishable/anon**.
`config.h` está en `.gitignore`. Nunca uses la secret/service_role en el dispositivo.

Conexión: rojo → 3V3, negro → GND, amarillo → GPIO 4, resistencia de 4,7 kΩ entre DATA y 3V3 (ver `docs/MediFrost_conexion_ESP32_DS18B20.png`).
