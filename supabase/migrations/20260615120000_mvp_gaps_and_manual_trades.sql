-- ============================================================
-- Migración incremental — cambios de esta sesión sobre una BD ya existente
-- (la BD que se creó con el schema.sql original, sin estas adiciones).
--
-- Idempotente: se puede ejecutar varias veces sin error.
-- Aplicar en Supabase → SQL Editor (pegar y Run), o vía psql/CLI.
--
-- Cubre:
--   1. trades.stop_price          (stop manual por trade)
--   2. trades.source              ('import' | 'manual')
--   3. tabla trade_attachments    (+ índice + RLS)
--   4. bucket privado de Storage  (+ policies por carpeta de usuario)
-- ============================================================

-- 1 + 2 ── Columnas nuevas en trades ─────────────────────────
alter table trades add column if not exists stop_price numeric(12,4);
alter table trades add column if not exists source     text not null default 'import';

-- 3 ── Tabla de adjuntos por trade ───────────────────────────
create table if not exists trade_attachments (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users not null,
  trade_id     uuid references trades(id) on delete cascade not null,
  storage_path text not null,
  file_name    text not null,
  mime_type    text not null,
  size_bytes   bigint not null,
  created_at   timestamptz default now()
);

create index if not exists trade_attachments_trade_id_idx
  on trade_attachments (trade_id);

alter table trade_attachments enable row level security;

drop policy if exists "Users see own attachments" on trade_attachments;
create policy "Users see own attachments" on trade_attachments
  for all using (auth.uid() = user_id);

-- 4 ── Storage: bucket privado + policies por carpeta {user_id}/… ──
insert into storage.buckets (id, name, public)
values ('trade-attachments', 'trade-attachments', false)
on conflict (id) do update set public = false;  -- fuerza privado aunque ya exista

drop policy if exists "Users read own trade attachments"   on storage.objects;
drop policy if exists "Users upload own trade attachments"  on storage.objects;
drop policy if exists "Users delete own trade attachments"  on storage.objects;

create policy "Users read own trade attachments"
  on storage.objects for select
  using (
    bucket_id = 'trade-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users upload own trade attachments"
  on storage.objects for insert
  with check (
    bucket_id = 'trade-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users delete own trade attachments"
  on storage.objects for delete
  using (
    bucket_id = 'trade-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
