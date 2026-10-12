// MediFrost – Nodo ESP32 + DS18B20
// HU01: medir la temperatura cada 60 s (Tarea T02 – Domenico Chang)
// HU02: enviar cada lectura por HTTPS a la API REST de Supabase (Tarea T06 – Domenico Chang)
#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <time.h>
#include "lectura.h"   // en Arduino IDE: misma carpeta que el .ino (2.ª pestaña)
#include "config.h"    // copia de config.example.h en esta carpeta (no se sube a GitHub)

using namespace medifrost;

constexpr int PIN_SENSOR = 4;                       // DQ del DS18B20 (pull-up de 4,7 kΩ a 3,3 V)
constexpr uint32_t ESPERA_WIFI_MS = 15000UL;        // tiempo máximo para conectar al WiFi
constexpr uint32_t TIMEOUT_HTTP_MS = 8000UL;        // la lectura debe guardarse en < 10 s (HU02-1)

OneWire oneWire(PIN_SENSOR);
DallasTemperature sensores(&oneWire);
uint32_t ultimaLectura = 0;
bool primeraLectura = true;

// Conecta (o reconecta) al WiFi sin bloquear más de ESPERA_WIFI_MS.
bool asegurarWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  Serial.printf("WiFi: conectando a «%s»...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  const uint32_t inicio = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - inicio < ESPERA_WIFI_MS) delay(250);
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("WiFi: conectado, IP %s\n", WiFi.localIP().toString().c_str());
    return true;
  }
  Serial.println("WiFi: sin conexión (se reintentará en el próximo envío)");
  return false;
}

// Un intento de POST a /rest/v1/lectura. Devuelve el código HTTP (o negativo si no hubo conexión).
int enviarUnaVez(const char* json) {
  WiFiClientSecure cliente;
  // Prototipo: no se valida el certificado del servidor (el tráfico igual va cifrado por TLS).
  // Riesgo registrado en la matriz RSK; en producción se carga el certificado raíz con setCACert().
  cliente.setInsecure();

  HTTPClient http;
  http.setTimeout(TIMEOUT_HTTP_MS);
  const String url = String(SUPABASE_URL) + "/rest/v1/lectura";
  if (!http.begin(cliente, url)) return -1;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", SUPABASE_KEY);
  // La clave legacy «anon» es un JWT (empieza con «eyJ») y también va en Authorization.
  if (strncmp(SUPABASE_KEY, "eyJ", 3) == 0) http.addHeader("Authorization", String("Bearer ") + SUPABASE_KEY);
  // return=minimal: el dispositivo no puede leer la tabla (RLS), solo insertar.
  http.addHeader("Prefer", "return=minimal");

  const int codigo = http.POST((uint8_t*)json, strlen(json));
  if (codigo > 0 && !envioAceptado(codigo)) {
    Serial.printf("Supabase respondió %d: %s\n", codigo, http.getString().c_str());
  }
  http.end();
  return codigo;
}

// Envía con hasta MAX_INTENTOS_ENVIO intentos y espera creciente (criterio HU02-2).
bool enviarLectura(const char* json) {
  for (int intento = 1; intento <= MAX_INTENTOS_ENVIO; intento++) {
    if (asegurarWifi()) {
      const int codigo = enviarUnaVez(json);
      if (envioAceptado(codigo)) {
        Serial.printf("Envío OK (HTTP %d) en el intento %d\n", codigo, intento);
        return true;
      }
      Serial.printf("Envío fallido (código %d), intento %d de %d\n", codigo, intento, MAX_INTENTOS_ENVIO);
    }
    if (intento < MAX_INTENTOS_ENVIO) delay(esperaReintentoMs(intento));
  }
  // HU03 (Sprint 3): aquí la lectura se guardará en una cola local para reenviarla.
  Serial.println("No se pudo enviar la lectura; se intentará con la siguiente.");
  return false;
}

void medirYEnviar() {
  sensores.requestTemperatures();
  const Lectura lectura = validarLectura(sensores.getTempCByIndex(0));

  char hora[24];
  const bool hayHora = formatearIsoUtc(time(nullptr), hora, sizeof(hora));

  char json[200];
  if (construirJsonLectura(json, sizeof(json), DISPOSITIVO_ID, lectura, hayHora ? hora : nullptr) < 0) {
    Serial.println("Error: el JSON no cabe en el búfer");
    return;
  }
  Serial.println(json);
  enviarLectura(json);
}

void setup() {
  Serial.begin(115200);
  sensores.begin();
  sensores.setResolution(12);                         // 0,0625 °C de resolución interna
  Serial.println("MediFrost: nodo iniciado. Lectura y envío cada 60 s.");
  asegurarWifi();
  configTime(0, 0, "pool.ntp.org", "time.google.com"); // hora UTC para «medido_en»
}

void loop() {
  const uint32_t ahora = millis();
  if (primeraLectura || tocaLeer(ahora, ultimaLectura)) {
    primeraLectura = false;
    ultimaLectura = ahora;
    medirYEnviar();
  }
  delay(100);
}
