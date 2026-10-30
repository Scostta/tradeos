-- ============================================================
-- Compartido · suscripciones Web Push (avisos en el móvil)
--
-- Una fila por navegador o dispositivo suscrito (endpoint del servicio push +
-- claves). La escriben el usuario desde Settings y el servidor (service role)
-- cuando el servicio push responde 404/410 y la suscripción ya no vale. Hoy la
-- usa Invest (run nuevo, señal de venta, fallo del job); no es de ningún módulo.
-- Desde el 2026-10-30, las tablas nuevas necesitan GRANT explícitos.
-- ============================================================

begin;

create table if not exists push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users on delete cascade not null,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz default now(),
  last_sent_at timestamptz
);

create index if not exists push_subscriptions_user_idx on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

drop policy if exists "Users manage own push subscriptions" on push_subscriptions;
create policy "Users manage own push subscriptions" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select on public.push_subscriptions to anon;
grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant select, insert, update, delete on public.push_subscriptions to service_role;

commit;
