// MediFrost – Configuración del nodo (PLANTILLA).
// 1) Copia este archivo como «config.h» en la MISMA carpeta.
// 2) Completa tus datos. «config.h» está en .gitignore: NUNCA se sube a GitHub.
#pragma once

// WiFi de la botica (o de tu casa para probar). En el simulador Wokwi usa "Wokwi-GUEST" y clave "".
#define WIFI_SSID      "Wokwi-GUEST"
#define WIFI_PASSWORD  ""

// Supabase → Project Settings → API Keys.
// Usa SOLO la clave PÚBLICA (publishable «sb_publishable_…» o la legacy «anon»).
// La política RLS hace que esta clave solo pueda INSERTAR lecturas (criterio HU02-3).
// ¡NUNCA pongas aquí la secret / service_role!
#define SUPABASE_URL   "https://xxxxxxxxxxxx.supabase.co"
#define SUPABASE_KEY   "sb_publishable_xxxxxxxxxxxxxxxx"

// Debe coincidir con el «ID del dispositivo» del sensor registrado en la web (HU21).
#define DISPOSITIVO_ID "MF-NODO-01"
