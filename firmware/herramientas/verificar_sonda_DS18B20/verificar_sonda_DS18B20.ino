/*
  MediFrost - Verificacion de la sonda DS18B20 (CP-02)
  ----------------------------------------------------
  PARTE 1 (al encender): revisa si la sonda es original o copia.
    - Codigo ROM (familia 0x28 y patron 28-xx-xx-xx-xx-00-00-xx)
    - CRC del ROM
    - Alimentacion (debe ser externa, no parasita)
    - Tiempo de conversion a 12 bits (original: ~580-615 ms)
    - Byte 6 del scratchpad (original: 0x10 - (byte0 & 0x0F))
  PARTE 2 (despues): modo VASO CON HIELO.
    - Lee cada ~1 s, promedio de las ultimas 30 lecturas, min, max
    - Dice "ESTABLE" cuando las 30 lecturas varian <= 0,125 C
    - El "error vs 0 C" es el offset de la sonda

  Comandos por el Monitor Serie (115200 baudios):
    r = reinicia el promedio     t = repite la PARTE 1

  Fuente de las pruebas de copia: github.com/cpetrich/counterfeit_DS18B20
  Solo usa comandos estandar del DS18B20 (no daña la sonda).
  Sin WiFi: no envia nada a Supabase.
*/

#include <OneWire.h>
#include <DallasTemperature.h>

// >>> Usa el MISMO pin de datos que tu nodo MediFrost <<<
#define PIN_ONEWIRE 4

const int N_PROM = 30;               // lecturas para el promedio (~30 s)
const float UMBRAL_ESTABLE = 0.125;  // 2 pasos de 0,0625 C

OneWire oneWire(PIN_ONEWIRE);
DallasTemperature sensores(&oneWire);
DeviceAddress dir;

float buf[N_PROM];
int nBuf = 0, iBuf = 0;
unsigned long nLectura = 0;

void imprimirDireccion(const DeviceAddress d) {
  for (int i = 0; i < 8; i++) {
    if (d[i] < 0x10) Serial.print('0');
    Serial.print(d[i], HEX);
    if (i < 7) Serial.print('-');
  }
}

void pruebaCopia() {
  Serial.println();
  Serial.println(F("=============================================="));
  Serial.println(F(" PARTE 1: ¿la sonda es original o copia?"));
  Serial.println(F("=============================================="));

  int nSensores = sensores.getDeviceCount();
  Serial.print(F("Sensores encontrados: "));
  Serial.println(nSensores);
  if (nSensores < 1 || !sensores.getAddress(dir, 0)) {
    Serial.println(F("ERROR: no se encuentra la sonda. Revisa cables y la resistencia de 4,7k."));
    return;
  }

  int fallas = 0;

  // 1) Codigo ROM
  Serial.print(F("1) Codigo ROM: "));
  imprimirDireccion(dir);
  Serial.println();
  bool familiaOk = (dir[0] == 0x28);
  bool patronOk  = (dir[5] == 0x00 && dir[6] == 0x00 && dir[4] != 0x00);
  Serial.print(F("   Familia 0x28 (DS18B20): "));
  Serial.println(familiaOk ? F("OK") : F("NO -> no es DS18B20"));
  Serial.print(F("   Patron original 28-xx-xx-xx-xx-00-00-xx: "));
  if (patronOk) {
    Serial.println(F("OK"));
  } else {
    Serial.println(F("NO -> patron de copia"));
    fallas++;
  }
  if (!familiaOk) fallas++;

  // 2) CRC del ROM
  bool crcOk = (OneWire::crc8(dir, 7) == dir[7]);
  Serial.print(F("2) CRC del ROM: "));
  Serial.println(crcOk ? F("OK") : F("ERROR -> revisar cableado"));

  // 3) Alimentacion
  bool parasita = sensores.isParasitePowerMode();
  Serial.print(F("3) Alimentacion: "));
  Serial.println(parasita ? F("PARASITA (conecta VDD a 3,3V para esta prueba)")
                          : F("externa (OK)"));

  // 4) Tiempo de conversion a 12 bits
  sensores.setResolution(dir, 12);
  sensores.setWaitForConversion(false);
  unsigned long t0 = millis();
  sensores.requestTemperaturesByAddress(dir);
  while (!sensores.isConversionComplete() && millis() - t0 < 2000) {
    delay(1);
  }
  unsigned long tConv = millis() - t0;
  sensores.setWaitForConversion(true);
  Serial.print(F("4) Tiempo de conversion (12 bits): "));
  Serial.print(tConv);
  Serial.print(F(" ms -> "));
  if (parasita) {
    Serial.println(F("no se puede medir en modo parasito"));
  } else if (tConv >= 450 && tConv <= 750) {
    Serial.println(F("OK (original: ~580-615 ms)"));
  } else {
    Serial.println(F("FUERA de lo normal -> tipico de copia"));
    fallas++;
  }

  // 5) Byte 6 del scratchpad
  uint8_t sp[9];
  sensores.readScratchPad(dir, sp);
  Serial.print(F("5) Scratchpad: "));
  for (int i = 0; i < 9; i++) {
    if (sp[i] < 0x10) Serial.print('0');
    Serial.print(sp[i], HEX);
    Serial.print(' ');
  }
  Serial.println();
  uint8_t esperado = 0x10 - (sp[0] & 0x0F);
  Serial.print(F("   Byte 6 = 0x"));
  Serial.print(sp[6], HEX);
  Serial.print(F(", original seria 0x"));
  Serial.print(esperado, HEX);
  if (sp[6] == esperado) {
    Serial.println(F(" -> OK"));
  } else {
    Serial.println(F(" -> NO coincide -> tipico de copia"));
    fallas++;
  }

  Serial.println(F("----------------------------------------------"));
  if (fallas == 0) {
    Serial.println(F("RESULTADO: pasa las 5 pruebas -> probablemente ORIGINAL"));
  } else {
    Serial.print(F("RESULTADO: falla "));
    Serial.print(fallas);
    Serial.println(F(" prueba(s) -> la sonda es COPIA"));
  }
  Serial.println(F("(Saca captura de esta parte)"));
  Serial.println();
  Serial.println(F("=============================================="));
  Serial.println(F(" PARTE 2: VASO CON HIELO  (r = reiniciar promedio)"));
  Serial.println(F("=============================================="));
}

void reiniciarPromedio() {
  nBuf = 0;
  iBuf = 0;
  Serial.println(F(">> Promedio reiniciado"));
}

void setup() {
  Serial.begin(115200);
  delay(1500);
  sensores.begin();
  pruebaCopia();
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 'r' || c == 'R') reiniciarPromedio();
    if (c == 't' || c == 'T') { pruebaCopia(); reiniciarPromedio(); }
  }

  sensores.requestTemperaturesByAddress(dir);   // espera ~750 ms (12 bits)
  float t = sensores.getTempC(dir);
  nLectura++;

  if (t == DEVICE_DISCONNECTED_C || t == 85.0) {
    Serial.print('#');
    Serial.print(nLectura);
    Serial.println(F("  lectura invalida (sonda desconectada o sin conversion)"));
    delay(250);
    return;
  }

  buf[iBuf] = t;
  iBuf = (iBuf + 1) % N_PROM;
  if (nBuf < N_PROM) nBuf++;

  float suma = 0, mn = buf[0], mx = buf[0];
  for (int i = 0; i < nBuf; i++) {
    suma += buf[i];
    if (buf[i] < mn) mn = buf[i];
    if (buf[i] > mx) mx = buf[i];
  }
  float prom = suma / nBuf;
  bool estable = (nBuf == N_PROM) && (mx - mn <= UMBRAL_ESTABLE);

  Serial.print('#');
  Serial.print(nLectura);
  Serial.print(F("  T = "));
  Serial.print(t, 4);
  Serial.print(F(" C | prom("));
  Serial.print(nBuf);
  Serial.print(F(") = "));
  Serial.print(prom, 3);
  Serial.print(F(" C | min "));
  Serial.print(mn, 4);
  Serial.print(F(" max "));
  Serial.print(mx, 4);
  Serial.print(F(" | error vs 0 C = "));
  if (prom >= 0) Serial.print('+');
  Serial.print(prom, 3);
  Serial.println(estable ? F(" | ESTABLE") : F(" | esperando..."));

  delay(250);
}
