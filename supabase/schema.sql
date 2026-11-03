-- =====================================================================
-- MediFrost – Esquema de base de datos (Supabase / PostgreSQL)
-- Tarea T12 (HU21) y T05 (HU02) – Responsable: Ian Flores
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Refrigeradoras (HU21) con su configuración de alertas (HU11 / RF02)
-- ---------------------------------------------------------------------
create table if not exists refrigeradora (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null check (char_length(nombre) between 1 and 80),
  ubicacion       text,
  temp_min        numeric(4,1) not null default 2.0,   -- °C
  temp_max        numeric(4,1) not null default 8.0,   -- °C
  tolerancia_min  integer      not null default 15,    -- minutos fuera de rango antes de alertar
  activa          boolean      not null default true,
  creado_en       timestamptz  not null default now(),
  actualizado_en  timestamptz  not null default now(),
  constraint rango_valido      check (temp_min < temp_max),
  constraint tolerancia_valida check (tolerancia_min between 1 and 60)
);

-- ---------------------------------------------------------------------
-- Sensores y datos de calibración (HU21 / RF08 / RNF04)
-- Un dispositivo solo puede estar vinculado a una refrigeradora y
-- cada refrigeradora tiene un solo sensor (restricciones UNIQUE).
-- ---------------------------------------------------------------------
create table if not exists sensor (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique,            -- p. ej. DS18B20-001
  dispositivo_id     text not null unique,            -- p. ej. MF-NODO-01 (lo envía el ESP32)
  refrigeradora_id   uuid unique references refrigeradora(id) on delete set null,
  fecha_calibracion  date,
  nro_certificado    text,
  vence_calibracion  date,
  creado_en          timestamptz not null default now(),
  constraint fechas_calibracion check (
    vence_calibracion is null or fecha_calibracion is null or vence_calibracion >= fecha_calibracion
  )
);

-- ---------------------------------------------------------------------
-- Lecturas de temperatura (HU01 / HU02 / RF01)
-- El ESP32 inserta directamente por HTTPS (API REST de Supabase).
-- ---------------------------------------------------------------------
create table if not exists lectura (
  id              bigint generated always as identity primary key,
  dispositivo_id  text not null,
  temperatura     numeric(5,2),
  estado          text not null default 'ok' check (estado in ('ok', 'error_sensor')),
  medido_en       timestamptz not null default now(),
  recibido_en     timestamptz not null default now(),
  constraint lectura_unica unique (dispositivo_id, medido_en)   -- evita duplicados al reenviar (HU03)
);

create index if not exists idx_lectura_dispositivo_fecha on lectura (dispositivo_id, medido_en desc);

-- ---------------------------------------------------------------------
-- Seguridad (RLS). El backend usa la clave service_role, que no pasa por RLS.
-- La clave pública (anon) que va en el ESP32 SOLO puede insertar lecturas:
-- no puede leer, modificar ni borrar nada (criterio 3 de HU02, refuerza HU19).
-- ---------------------------------------------------------------------
alter table refrigeradora enable row level security;
alter table sensor        enable row level security;
alter table lectura       enable row level security;

drop policy if exists "dispositivo_solo_inserta_lecturas" on lectura;
create policy "dispositivo_solo_inserta_lecturas"
  on lectura for insert
  to anon
  with check (true);

-- Mantener actualizado_en al editar una refrigeradora
create or replace function tocar_actualizado_en() returns trigger as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_refrigeradora_actualizado on refrigeradora;
create trigger trg_refrigeradora_actualizado
  before update on refrigeradora
  for each row execute function tocar_actualizado_en();

-- ---------------------------------------------------------------------
-- Datos de ejemplo para la demo (opcional; se pueden borrar)
-- ---------------------------------------------------------------------
insert into refrigeradora (nombre, ubicacion)
values ('Refrigeradora principal', 'Mostrador – Boticas Perú (piloto)')
on conflict do nothing;
