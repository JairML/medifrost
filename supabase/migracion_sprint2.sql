-- =====================================================================
-- MediFrost – Migración del Sprint 2 (19/10 – 30/10/2026)
-- Tarea T20 (HU12) – Responsable: Ian Flores (Configuración e Infraestructura)
-- Agrega las tablas de alertas (HU12, HU13, HU04), usuarios (HU20) y
-- eventos del nodo (HU04), y dos columnas de energía en «lectura».
--
-- Cómo usarlo (UNA sola vez, sobre la base que ya tiene schema.sql):
--   Supabase → SQL Editor → New query → pegar todo este archivo → Run
-- Se puede volver a ejecutar sin romper nada (usa «if not exists»).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Lecturas: estado de la alimentación del nodo (HU04)
--    El ESP32 las envía junto con la temperatura. Son opcionales
--    (null = el nodo todavía no tiene el circuito de batería).
-- ---------------------------------------------------------------------
alter table lectura add column if not exists alimentacion text;
alter table lectura add column if not exists bateria_pct  smallint;

alter table lectura drop constraint if exists lectura_alimentacion_valida;
alter table lectura add  constraint lectura_alimentacion_valida
  check (alimentacion is null or alimentacion in ('externa', 'bateria'));

alter table lectura drop constraint if exists lectura_bateria_valida;
alter table lectura add  constraint lectura_bateria_valida
  check (bateria_pct is null or bateria_pct between 0 and 100);

-- ---------------------------------------------------------------------
-- 2) Eventos del nodo (HU04): corte de energía, energía restaurada y
--    batería baja. El ESP32 los inserta con la clave pública, igual que
--    las lecturas; el backend los procesa y envía la alerta por correo.
-- ---------------------------------------------------------------------
create table if not exists evento_nodo (
  id              bigint generated always as identity primary key,
  dispositivo_id  text not null,
  tipo            text not null check (tipo in ('corte_energia', 'energia_restaurada', 'bateria_baja')),
  bateria_pct     smallint check (bateria_pct is null or bateria_pct between 0 and 100),
  ocurrido_en     timestamptz not null default now(),
  recibido_en     timestamptz not null default now(),
  procesado_en    timestamptz,                         -- lo marca el backend al enviar la alerta
  constraint evento_unico unique (dispositivo_id, tipo, ocurrido_en)  -- evita duplicados al reenviar
);

create index if not exists idx_evento_pendiente on evento_nodo (recibido_en) where procesado_en is null;

-- ---------------------------------------------------------------------
-- 3) Alertas (HU12 temperatura, HU13 sin señal, HU04 energía).
--    Ciclo de vida:
--      pendiente  → fuera de rango, todavía dentro del tiempo de tolerancia (no se envía correo)
--      activa     → se envió el correo; se repite cada 30 min
--      atendida   → un usuario la marcó como atendida; ya no se repite
--      cerrada    → la condición terminó (se envió el aviso de normalización)
--      descartada → volvió al rango antes de cumplir la tolerancia (nunca se envió correo)
-- ---------------------------------------------------------------------
create table if not exists alerta (
  id                uuid primary key default gen_random_uuid(),
  refrigeradora_id  uuid not null references refrigeradora(id) on delete cascade,
  tipo              text not null check (tipo in ('temperatura', 'sin_senal', 'corte_energia', 'bateria_baja')),
  estado            text not null default 'pendiente'
                    check (estado in ('pendiente', 'activa', 'atendida', 'cerrada', 'descartada')),
  sentido           text check (sentido is null or sentido in ('alta', 'baja')),  -- solo temperatura
  inicio_en         timestamptz not null,       -- desde cuándo ocurre la condición
  notificada_en     timestamptz,                -- primer correo
  ultimo_envio_en   timestamptz,                -- último correo (para repetir cada 30 min)
  envios            integer not null default 0,
  valor_extremo     numeric(5,2),               -- temperatura más alejada del rango
  ultimo_valor      numeric(5,2),
  bateria_pct       smallint,
  atendida_en       timestamptz,
  atendida_por      text,
  cerrada_en        timestamptz,
  creado_en         timestamptz not null default now()
);

-- Una refrigeradora no puede tener dos alertas abiertas del mismo tipo
create unique index if not exists alerta_abierta_unica
  on alerta (refrigeradora_id, tipo)
  where estado in ('pendiente', 'activa', 'atendida');

create index if not exists idx_alerta_refrigeradora_fecha on alerta (refrigeradora_id, inicio_en desc);

-- ---------------------------------------------------------------------
-- 4) Usuarios (HU20). La contraseña se guarda solo como hash bcrypt.
--    Tras 5 intentos fallidos la cuenta se bloquea 5 minutos.
-- ---------------------------------------------------------------------
create table if not exists usuario (
  id                 uuid primary key default gen_random_uuid(),
  correo             text not null unique check (correo = lower(correo) and position('@' in correo) > 1),
  nombre             text not null check (char_length(nombre) between 1 and 80),
  rol                text not null check (rol in ('administrador', 'directora_tecnica', 'tecnico')),
  hash_contrasena    text not null,
  intentos_fallidos  integer not null default 0,
  bloqueado_hasta    timestamptz,
  activo             boolean not null default true,
  creado_en          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 5) Seguridad (RLS)
--    • alerta y usuario: sin políticas → solo el backend (clave secreta) puede leer y escribir.
--    • evento_nodo: la clave pública del ESP32 SOLO puede insertar (como en «lectura»).
-- ---------------------------------------------------------------------
alter table evento_nodo enable row level security;
alter table alerta      enable row level security;
alter table usuario     enable row level security;

drop policy if exists "dispositivo_solo_inserta_eventos" on evento_nodo;
create policy "dispositivo_solo_inserta_eventos"
  on evento_nodo for insert
  to anon
  with check (procesado_en is null);

-- ---------------------------------------------------------------------
-- Comprobación rápida (debe mostrar las 3 tablas nuevas):
--   select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('alerta', 'usuario', 'evento_nodo');
-- ---------------------------------------------------------------------
