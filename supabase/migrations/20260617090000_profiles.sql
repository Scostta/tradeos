-- ============================================================
-- Perfil de usuario (1:1 con auth.users). Guarda preferencias:
--   - display_name      nombre visible en la UI (footer del sidebar)
--   - timezone          zona horaria del trader (IANA). Por ahora solo se
--                       persiste; el bucketing de insights/journal/reports
--                       sigue en UTC hasta un cambio posterior.
--   - default_currency  divisa por defecto del usuario
-- No hay trigger de auto-creación: la query devuelve defaults si no hay fila
-- y la action hace upsert por (user_id) la primera vez. Idempotente.
-- ============================================================
create table if not exists profiles (
  user_id          uuid primary key references auth.users on delete cascade,
  display_name     text,
  timezone         text not null default 'UTC',
  default_currency text not null default 'USD',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "Users manage own profile" on profiles;
create policy "Users manage own profile" on profiles
  for all using (auth.uid() = user_id);
