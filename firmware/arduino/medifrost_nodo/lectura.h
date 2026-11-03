// MediFrost – Lógica pura del nodo (sin dependencias de Arduino) para poder probarla en la PC.
// HU01 · Tarea T02 (Domenico Chang) · HU02 · Tarea T06 (Domenico Chang)
// Pruebas: CP-01 (T03, Kheyla Cóndor) y envío a la nube (T08)
#pragma once
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stddef.h>
#include <time.h>

namespace medifrost {

// La librería DallasTemperature devuelve -127 °C cuando el sensor no responde.
constexpr float SENSOR_DESCONECTADO = -127.0f;
// Rango de medición del DS18B20 según su hoja de datos.
constexpr float RANGO_MIN_SENSOR = -55.0f;
constexpr float RANGO_MAX_SENSOR = 125.0f;
// Intervalo de lectura del criterio HU01-1.
constexpr uint32_t INTERVALO_LECTURA_MS = 60000UL;
// Reintentos de envío (criterio HU02-2): 3 intentos con espera creciente de 1 s, 2 s y 4 s.
constexpr int MAX_INTENTOS_ENVIO = 3;
// Una hora válida del reloj (NTP) es posterior al 01/01/2024.
constexpr time_t EPOCA_MINIMA_VALIDA = 1704067200;

enum class EstadoLectura { OK, ERROR_SENSOR };

struct Lectura {
  float temperatura;      // °C con un decimal (solo válido si estado == OK)
  EstadoLectura estado;
};

// Redondea a 0,1 °C (criterio HU01-1: resolución de 0,1 °C).
inline float redondearDecima(float valor) {
  return roundf(valor * 10.0f) / 10.0f;
}

// Criterio HU01-2: si el sensor está desconectado o el valor es imposible,
// la lectura se marca como «error de sensor» y no se envía como válida.
inline Lectura validarLectura(float celsius) {
  if (isnan(celsius) || celsius < RANGO_MIN_SENSOR || celsius > RANGO_MAX_SENSOR) {
    return {0.0f, EstadoLectura::ERROR_SENSOR};   // incluye el -127 °C de sensor desconectado
  }
  return {redondearDecima(celsius), EstadoLectura::OK};
}

// Indica si ya pasó el intervalo desde la última lectura.
// Se usa uint32_t (igual que millis() en el ESP32): la resta sin signo funciona
// aunque millis() vuelva a 0 (cada ~49 días).
inline bool tocaLeer(uint32_t ahoraMs, uint32_t ultimaMs,
                     uint32_t intervaloMs = INTERVALO_LECTURA_MS) {
  return (uint32_t)(ahoraMs - ultimaMs) >= intervaloMs;
}

inline const char* textoEstado(EstadoLectura e) {
  return e == EstadoLectura::OK ? "ok" : "error_sensor";
}

// ---------- HU02: envío a Supabase ----------

// Espera antes del intento n (1, 2, 3...): 1 s, 2 s, 4 s.
inline uint32_t esperaReintentoMs(int intento) {
  if (intento <= 1) return 1000UL;
  if (intento > 6) intento = 6;
  return 1000UL << (intento - 1);
}

// El envío fue aceptado: 201 (creado) o 409 (ya existía esa lectura, no es un error).
inline bool envioAceptado(int codigoHttp) {
  return codigoHttp == 201 || codigoHttp == 409;
}

// Escribe la hora UTC en formato ISO 8601 («2026-10-12T14:05:00Z»).
// Devuelve false si el reloj todavía no se sincronizó por NTP.
inline bool formatearIsoUtc(time_t segundos, char* destino, size_t tam) {
  if (segundos < EPOCA_MINIMA_VALIDA || tam < 21) return false;
  struct tm t;
#if defined(_WIN32)
  gmtime_s(&t, &segundos);
#else
  gmtime_r(&segundos, &t);
#endif
  return strftime(destino, tam, "%Y-%m-%dT%H:%M:%SZ", &t) == 20;
}

// Arma el cuerpo JSON que espera la tabla «lectura» de Supabase.
// Si la lectura es error_sensor, la temperatura va como null (criterio HU01-2).
// Si no hay hora válida (medidoEn == nullptr), se omite y Supabase usa now().
// Devuelve la longitud escrita, o -1 si no cabe en el búfer.
inline int construirJsonLectura(char* destino, size_t tam, const char* dispositivoId,
                                const Lectura& l, const char* medidoEn) {
  char temp[16];
  if (l.estado == EstadoLectura::OK) snprintf(temp, sizeof(temp), "%.1f", l.temperatura);
  else snprintf(temp, sizeof(temp), "null");

  int n;
  if (medidoEn != nullptr) {
    n = snprintf(destino, tam,
                 "{\"dispositivo_id\":\"%s\",\"temperatura\":%s,\"estado\":\"%s\",\"medido_en\":\"%s\"}",
                 dispositivoId, temp, textoEstado(l.estado), medidoEn);
  } else {
    n = snprintf(destino, tam,
                 "{\"dispositivo_id\":\"%s\",\"temperatura\":%s,\"estado\":\"%s\"}",
                 dispositivoId, temp, textoEstado(l.estado));
  }
  return (n < 0 || (size_t)n >= tam) ? -1 : n;
}

}  // namespace medifrost
