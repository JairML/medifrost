// CP-01 (Unitaria) – HU01: conversión y validación de la lectura. Tarea T03 – Kheyla Cóndor
// Ejecutar en la computadora (sin placa): pio test -e native
#include <unity.h>
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
  return UNITY_END();
}
