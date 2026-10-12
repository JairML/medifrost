// CP-01 (Unitaria) – HU01: conversión y validación de la lectura. Tarea T03 – Kheyla Cóndor
// CP-03 (Unitaria) – HU02: cuerpo JSON, hora UTC y reintentos del envío. Tarea T08 – Kheyla Cóndor
// Ejecutar en la computadora (sin placa): pio test -e native
#include <unity.h>
#include <string.h>
#include "../../include/lectura.h"

using namespace medifrost;

void setUp() {}
void tearDown() {}

void test_lectura_normal_se_redondea_a_una_decima() {
  Lectura l = validarLectura(4.26f);
  TEST_ASSERT_TRUE(l.estado == EstadoLectura::OK);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, 4.3f, l.temperatura);
}

void test_sensor_desconectado_es_error() {
  TEST_ASSERT_TRUE(validarLectura(SENSOR_DESCONECTADO).estado == EstadoLectura::ERROR_SENSOR);
}

void test_valores_fuera_del_rango_del_sensor_son_error() {
  TEST_ASSERT_TRUE(validarLectura(130.0f).estado == EstadoLectura::ERROR_SENSOR);
  TEST_ASSERT_TRUE(validarLectura(-60.0f).estado == EstadoLectura::ERROR_SENSOR);
}

void test_limites_del_rango_son_validos() {
  TEST_ASSERT_TRUE(validarLectura(-55.0f).estado == EstadoLectura::OK);
  TEST_ASSERT_TRUE(validarLectura(125.0f).estado == EstadoLectura::OK);
}

void test_temperaturas_bajo_cero_son_validas() {
  Lectura l = validarLectura(-0.44f);
  TEST_ASSERT_TRUE(l.estado == EstadoLectura::OK);
  TEST_ASSERT_FLOAT_WITHIN(0.001f, -0.4f, l.temperatura);
}

void test_nan_es_error() {
  TEST_ASSERT_TRUE(validarLectura(NAN).estado == EstadoLectura::ERROR_SENSOR);
}

void test_toca_leer_cada_60_segundos() {
  TEST_ASSERT_FALSE(tocaLeer(59999UL, 0UL));
  TEST_ASSERT_TRUE(tocaLeer(60000UL, 0UL));
}

void test_toca_leer_aunque_millis_vuelva_a_cero() {
  // última lectura justo antes del desborde de 32 bits; «ahora» ya pasó el desborde
  const uint32_t antesDelDesborde = 4294967295UL - 1000UL;
  TEST_ASSERT_TRUE(tocaLeer(59000UL, antesDelDesborde));
  TEST_ASSERT_FALSE(tocaLeer(10UL, antesDelDesborde));
}

// ---------- HU02 ----------
void test_json_lectura_valida_con_hora() {
  char buf[200];
  Lectura l = validarLectura(4.26f);
  int n = construirJsonLectura(buf, sizeof(buf), "MF-NODO-01", l, "2026-10-12T14:05:00Z");
  TEST_ASSERT_TRUE(n > 0);
  TEST_ASSERT_EQUAL_STRING(
      "{\"dispositivo_id\":\"MF-NODO-01\",\"temperatura\":4.3,\"estado\":\"ok\",\"medido_en\":\"2026-10-12T14:05:00Z\"}", buf);
}

void test_json_error_sensor_envia_temperatura_null() {
  char buf[200];
  Lectura l = validarLectura(SENSOR_DESCONECTADO);
  construirJsonLectura(buf, sizeof(buf), "MF-NODO-01", l, nullptr);
  TEST_ASSERT_EQUAL_STRING("{\"dispositivo_id\":\"MF-NODO-01\",\"temperatura\":null,\"estado\":\"error_sensor\"}", buf);
}

void test_json_sin_espacio_devuelve_error() {
  char buf[20];
  TEST_ASSERT_EQUAL_INT(-1, construirJsonLectura(buf, sizeof(buf), "MF-NODO-01", validarLectura(5.0f), nullptr));
}

void test_hora_iso_utc() {
  char buf[24];
  TEST_ASSERT_TRUE(formatearIsoUtc((time_t)1791814500, buf, sizeof(buf)));   // 12/10/2026 14:15:00 UTC
  TEST_ASSERT_EQUAL_STRING("2026-10-12T14:15:00Z", buf);
}

void test_hora_no_sincronizada_no_se_usa() {
  char buf[24];
  TEST_ASSERT_FALSE(formatearIsoUtc((time_t)5, buf, sizeof(buf)));   // reloj en 1970: aún sin NTP
}

void test_reintentos_esperan_1_2_y_4_segundos() {
  TEST_ASSERT_EQUAL_UINT32(1000, esperaReintentoMs(1));
  TEST_ASSERT_EQUAL_UINT32(2000, esperaReintentoMs(2));
  TEST_ASSERT_EQUAL_UINT32(4000, esperaReintentoMs(3));
}

void test_codigos_http_aceptados() {
  TEST_ASSERT_TRUE(envioAceptado(201));
  TEST_ASSERT_TRUE(envioAceptado(409));   // la lectura ya estaba guardada
  TEST_ASSERT_FALSE(envioAceptado(401));
  TEST_ASSERT_FALSE(envioAceptado(-1));   // sin conexión
}

int main() {
  UNITY_BEGIN();
  RUN_TEST(test_lectura_normal_se_redondea_a_una_decima);
  RUN_TEST(test_sensor_desconectado_es_error);
  RUN_TEST(test_valores_fuera_del_rango_del_sensor_son_error);
  RUN_TEST(test_limites_del_rango_son_validos);
  RUN_TEST(test_temperaturas_bajo_cero_son_validas);
  RUN_TEST(test_nan_es_error);
  RUN_TEST(test_toca_leer_cada_60_segundos);
  RUN_TEST(test_toca_leer_aunque_millis_vuelva_a_cero);
  RUN_TEST(test_json_lectura_valida_con_hora);
  RUN_TEST(test_json_error_sensor_envia_temperatura_null);
  RUN_TEST(test_json_sin_espacio_devuelve_error);
  RUN_TEST(test_hora_iso_utc);
  RUN_TEST(test_hora_no_sincronizada_no_se_usa);
  RUN_TEST(test_reintentos_esperan_1_2_y_4_segundos);
  RUN_TEST(test_codigos_http_aceptados);
  return UNITY_END();
}
