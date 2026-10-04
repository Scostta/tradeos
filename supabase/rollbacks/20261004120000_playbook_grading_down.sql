-- ============================================================
-- ROLLBACK de 20261004120000_playbook_grading.sql (rules v2 → v1).
-- No vive en migrations/: se aplica a mano (SQL editor / psql) si hace falta.
--
-- - Filas sin cambios desde la migración → se restaura el valor original exacto
--   desde playbook_grading_backup (incluidos los textos huérfanos).
-- - Filas editadas después (o creadas después) → se convierten de v2 a v1 con
--   las reglas actuales: ids → textos; min.entry = nº obligatorios + umbral B.
--   Los textos huérfanos de esas filas no se recuperan (no casaban con ningún
--   criterio, así que no afectaban a nada).
-- Al final borra playbook_grading_backup. Todo corre en una transacción.
-- ============================================================

begin;

create or replace function pg_temp.grading_try_json(raw text)
returns jsonb language plpgsql immutable as $f$
begin
  return raw::jsonb;
exception when others then
  return null;
end
$f$;

-- Textos de un grupo v2.
create or replace function pg_temp.grading_texts(arr jsonb)
returns jsonb language sql immutable as $f$
  select coalesce(jsonb_agg(e.item ->> 'text' order by e.pos), '[]'::jsonb)
  from jsonb_array_elements(
    case when jsonb_typeof(arr) = 'array' then arr else '[]'::jsonb end
  ) with ordinality as e(item, pos)
$f$;

do $$
declare
  tr             record;
  pb             record;
  r              jsonb;
  texts          text[];
  e_len          int;
  req            int;
  n_tr_restored  int := 0;
  n_tr_converted int := 0;
  n_pb_restored  int := 0;
  n_pb_converted int := 0;
begin
  if to_regclass('public.playbook_grading_backup') is null then
    raise exception 'playbook_grading_backup no existe: nada que revertir';
  end if;

  -- 1) Trades (antes que los playbooks: necesita las reglas v2 para mapear ids).
  --    Se restaura el original solo si ni el trade ni su playbook cambiaron;
  --    si el playbook se editó (p. ej. criterio renombrado), se convierte con
  --    las reglas actuales para que los textos casen con el playbook revertido.
  for tr in
    select t.id, t.followed_rules, p.rules as pb_rules,
           bt.row_id is not null as in_backup, bt.original_followed, bt.migrated_followed,
           bp.migrated_rules as pb_migrated_rules,
           bp.row_id is not null
             and pg_temp.grading_try_json(p.rules) = pg_temp.grading_try_json(bp.migrated_rules) as pb_unchanged
      from trades t
      left join playbooks p on p.id = t.playbook_id
      left join playbook_grading_backup bt on bt.kind = 'trade'    and bt.row_id = t.id
      left join playbook_grading_backup bp on bp.kind = 'playbook' and bp.row_id = t.playbook_id
     where t.followed_rules is not null or bt.row_id is not null
  loop
    if tr.in_backup and tr.pb_unchanged and tr.followed_rules is not distinct from tr.migrated_followed then
      update trades set followed_rules = tr.original_followed where id = tr.id;
      n_tr_restored := n_tr_restored + 1;
      continue;
    end if;

    if tr.followed_rules is null then continue; end if;   -- checklist reseteado tras migrar
    r := pg_temp.grading_try_json(tr.pb_rules);
    if r is null or jsonb_typeof(r) <> 'object' or r -> 'version' is null then continue; end if;

    -- ids → textos (sin duplicar un texto presente en varios grupos).
    select coalesce(array_agg(x.txt order by x.o), '{}')
      into texts
      from (
        select c.item ->> 'text' as txt, min(f.ord * 1000 + c.pos) as o
          from unnest(tr.followed_rules) with ordinality as f(id, ord)
          join jsonb_array_elements(
                 coalesce(r -> 'entry', '[]') || coalesce(r -> 'exit', '[]') || coalesce(r -> 'conditions', '[]')
               ) with ordinality as c(item, pos)
            on c.item ->> 'id' = f.id
         group by c.item ->> 'text'
      ) x;

    -- Recupera los textos huérfanos que tenía antes de migrar.
    if tr.in_backup and tr.pb_migrated_rules is not null then
      r := tr.pb_migrated_rules::jsonb;
      texts := texts || array(
        select u.txt
          from unnest(tr.original_followed) with ordinality as u(txt, ord)
         where not (u.txt = any(texts))
           and not exists (
             select 1
               from jsonb_array_elements((r -> 'entry') || (r -> 'exit') || (r -> 'conditions')) as c(item)
              where c.item ->> 'text' = u.txt
           )
         order by u.ord
      );
    end if;

    update trades set followed_rules = texts where id = tr.id;
    n_tr_converted := n_tr_converted + 1;
  end loop;

  -- 2) Playbooks.
  for pb in
    select p.id, p.rules, b.row_id is not null as in_backup, b.original_rules, b.migrated_rules
      from playbooks p
      left join playbook_grading_backup b on b.kind = 'playbook' and b.row_id = p.id
  loop
    r := pg_temp.grading_try_json(pb.rules);
    if r is null or jsonb_typeof(r) <> 'object' or r -> 'version' is null then continue; end if;

    if pb.in_backup and r = pg_temp.grading_try_json(pb.migrated_rules) then
      update playbooks set rules = pb.original_rules where id = pb.id;
      n_pb_restored := n_pb_restored + 1;
      continue;
    end if;

    e_len := jsonb_array_length(pg_temp.grading_texts(r -> 'entry'));
    select count(*) into req
      from jsonb_array_elements(coalesce(r -> 'entry', '[]')) as e(item)
     where (e.item ->> 'required')::boolean is true;

    update playbooks set rules = jsonb_build_object(
      'entry',      pg_temp.grading_texts(r -> 'entry'),
      'exit',       pg_temp.grading_texts(r -> 'exit'),
      'conditions', pg_temp.grading_texts(r -> 'conditions'),
      'min', jsonb_build_object(
        'entry',      least(e_len, req + coalesce((r -> 'gradeMin' ->> 'b')::int, e_len - req)),
        'exit',       coalesce((r -> 'min' ->> 'exit')::int, jsonb_array_length(pg_temp.grading_texts(r -> 'exit'))),
        'conditions', coalesce((r -> 'min' ->> 'conditions')::int, jsonb_array_length(pg_temp.grading_texts(r -> 'conditions')))
      )
    )::text
    where id = pb.id;
    n_pb_converted := n_pb_converted + 1;
  end loop;

  raise notice 'playbook_grading rollback: playbooks % restaurados / % convertidos; trades % restaurados / % convertidos',
    n_pb_restored, n_pb_converted, n_tr_restored, n_tr_converted;
end $$;

drop table playbook_grading_backup;

commit;
