-- ============================================================
-- Tokens de API para la sincronización desde el add-on de NinjaTrader 8.
--
-- El add-on no tiene sesión de Supabase: se autentica contra
-- POST /api/ingest/ninjatrader con "Authorization: Bearer tos_...". Solo se
-- guarda el sha256 del token (se muestra una vez al crearlo); token_prefix es
-- para reconocerlo en la lista de /settings.
--
-- La ruta de ingest busca el token con el service-role client (no hay
-- auth.uid() en esa petición) y escribe siempre con el user_id del token.
--
-- trades.source admite ahora 'sync' además de 'import' | 'manual' (es text sin
-- check, no hace falta tocar la columna).
-- Rollback: supabase/rollbacks/20261020120000_api_tokens_down.sql
-- ============================================================

create table if not exists api_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users on delete cascade not null,
  name          text not null,
  token_hash    text unique not null,   -- sha256 hex del token en claro
  token_prefix  text not null,          -- "tos_abcd" — solo display
  last_used_at  timestamptz,
  revoked_at    timestamptz,
  created_at    timestamptz default now()
);

create index if not exists api_tokens_user_id_idx on api_tokens (user_id);

alter table api_tokens enable row level security;

drop policy if exists "Users manage own api tokens" on api_tokens;
create policy "Users manage own api tokens" on api_tokens
  for all using (auth.uid() = user_id);
