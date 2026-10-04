-- ============================================================
-- Grading de trades por confluencias (playbook rules v2).
--
-- playbooks.rules (JSON en texto) pasa de v1 a v2:
--   v1: { entry: [texto], exit: [texto], conditions: [texto],
--         min: { entry, exit, conditions } }
--   v2: { version: 2,
--         entry: [{ id, text, required }], exit: [{ id, text }], conditions: [{ id, text }],
--         min: { exit, conditions },
--         gradeMin: { b, a } }          -- mín. de confirmaciones de entrada por grado
-- trades.followed_rules pasa de textos de criterios a ids de criterios.
--
-- Umbrales iniciales (escala D/B/A, ningún criterio obligatorio):
--   A = total de confirmaciones
--   B = N actual si N < total; si no total − 1 (mínimo 1); 0 sin confirmaciones
-- Mantener en sync con legacyGradeMin() en src/helpers/playbook-rules.ts.
--
-- Idempotente: los playbooks que ya tienen `version` se saltan. Las reglas en
-- texto libre (no JSON) no se tocan.
-- Los valores originales se guardan en playbook_grading_backup.
-- Rollback: supabase/rollbacks/20261004120000_playbook_grading_down.sql
-- ============================================================

create table if not exists playbook_grading_backup (
  kind              text not null check (kind in ('playbook', 'trade')),
  row_id            uuid not null,
  original_rules    text,     -- playbooks.rules antes de migrar
  original_followed text[],   -- trades.followed_rules antes de migrar
  migrated_rules    text,     -- lo que escribió la migración (detecta ediciones posteriores)
  migrated_followed text[],
  created_at        timestamptz default now(),
  primary key (kind, row_id)
);

-- Sin policies: solo accesible con service role.
alter table playbook_grading_backup enable row level security;

-- Array v1 de textos → array v2 de criterios con id nuevo.
create or replace function pg_temp.grading_items(arr jsonb, with_required boolean)
returns jsonb language sql volatile as $f$
  select coalesce(
    jsonb_agg(
      case when with_required
        then jsonb_build_object('id', gen_random_uuid()::text, 'text', e.v, 'required', false)
        else jsonb_build_object('id', gen_random_uuid()::text, 'text', e.v)
      end
      order by e.ord
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements_text(
    case when jsonb_typeof(arr) = 'array' then arr else '[]'::jsonb end
  ) with ordinality as e(v, ord)
$f$;

-- min.<key> de v1 acotado a [0, len]; si no es número, len ("todos"), como el parser.
create or replace function pg_temp.grading_min(min_obj jsonb, key text, len int)
returns int language sql immutable as $f$
  select case
    when jsonb_typeof(min_obj -> key) = 'number'
      then least(len, greatest(0, round((min_obj ->> key)::numeric)::int))
    else len
  end
$f$;

do $$
declare
  pb           record;
  tr           record;
  orphan       record;
  r            jsonb;
  e_arr        jsonb;
  x_arr        jsonb;
  c_arr        jsonb;
  all_arr      jsonb;
  total        int;
  n            int;
  lower_min    int;
  new_rules    text;
  new_followed text[];
  n_playbooks  int := 0;
  n_trades     int := 0;
  n_orphans    int := 0;
begin
  create temp table if not exists _grading_orphans (
    playbook_id   uuid,
    playbook_name text,
    rule_text     text,
    trade_id      uuid
  );
  truncate _grading_orphans;

  for pb in select id, name, rules from playbooks where rules is not null order by created_at, id loop
    begin
      r := pb.rules::jsonb;
    exception when others then
      continue;   -- reglas en texto libre: no es JSON
    end;
    if jsonb_typeof(r) <> 'object' or r -> 'version' is not null then continue; end if;

    e_arr := pg_temp.grading_items(r -> 'entry', true);
    x_arr := pg_temp.grading_items(r -> 'exit', false);
    c_arr := pg_temp.grading_items(r -> 'conditions', false);
    if jsonb_array_length(e_arr) + jsonb_array_length(x_arr) + jsonb_array_length(c_arr) = 0 then
      continue;
    end if;

    total     := jsonb_array_length(e_arr);
    n         := pg_temp.grading_min(r -> 'min', 'entry', total);
    lower_min := case when total = 0 then 0 when n < total then n else greatest(1, total - 1) end;

    new_rules := jsonb_build_object(
      'version',    2,
      'entry',      e_arr,
      'exit',       x_arr,
      'conditions', c_arr,
      'min', jsonb_build_object(
        'exit',       pg_temp.grading_min(r -> 'min', 'exit', jsonb_array_length(x_arr)),
        'conditions', pg_temp.grading_min(r -> 'min', 'conditions', jsonb_array_length(c_arr))
      ),
      'gradeMin', jsonb_build_object('b', lower_min, 'a', total)
    )::text;

    insert into playbook_grading_backup (kind, row_id, original_rules, migrated_rules)
      values ('playbook', pb.id, pb.rules, new_rules)
      on conflict do nothing;
    update playbooks set rules = new_rules where id = pb.id;
    n_playbooks := n_playbooks + 1;

    -- followed_rules: texto → id(s). Un texto repetido en varios grupos se
    -- mapea a todos, igual que el checklist v1 marcaba ambos.
    all_arr := e_arr || x_arr || c_arr;
    for tr in
      select id, followed_rules from trades
      where playbook_id = pb.id and followed_rules is not null
    loop
      select coalesce(array_agg(c.item ->> 'id' order by f.ord, c.pos), '{}')
        into new_followed
        from unnest(tr.followed_rules) with ordinality as f(txt, ord)
        join jsonb_array_elements(all_arr) with ordinality as c(item, pos)
          on c.item ->> 'text' = f.txt;

      insert into _grading_orphans
        select pb.id, pb.name, f.txt, tr.id
          from unnest(tr.followed_rules) as f(txt)
         where not exists (
           select 1 from jsonb_array_elements(all_arr) as c(item) where c.item ->> 'text' = f.txt
         );

      insert into playbook_grading_backup (kind, row_id, original_followed, migrated_followed)
        values ('trade', tr.id, tr.followed_rules, new_followed)
        on conflict do nothing;
      update trades set followed_rules = new_followed where id = tr.id;
      n_trades := n_trades + 1;
    end loop;
  end loop;

  select count(*) into n_orphans
    from (select distinct playbook_id, rule_text from _grading_orphans) o;

  raise notice 'playbook_grading: % playbooks migrados, % trades convertidos, % textos huérfanos sin mapear',
    n_playbooks, n_trades, n_orphans;

  for orphan in
    select playbook_name, rule_text, count(*) as trades
      from _grading_orphans
     group by playbook_id, playbook_name, rule_text
     order by playbook_name, rule_text
  loop
    raise notice 'playbook_grading: huérfano en playbook "%": "%" (% trades) — conservado en playbook_grading_backup',
      orphan.playbook_name, orphan.rule_text, orphan.trades;
  end loop;

  drop table _grading_orphans;
end $$;
