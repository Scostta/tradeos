-- ============================================================
-- Módulo Invest — posiciones de papel (INVEST_SPEC.md §1.6, §4.4).
--
-- invest_positions.paper   posición de papel: no forma parte del test de 36
--                          meses. Pasa por las mismas validaciones de apertura
--                          y recibe los mismos checks hold/sell del job.
-- invest_settings.paper_mode
--                          true hasta que el usuario pulsa "Start real test"
--                          en ajustes; mientras es true, el modal abre
--                          posiciones de papel.
-- invest_settings.started_at
--                          pasa a nullable: lo fija la primera posición con
--                          paper = false (openInvestPosition). Sin posiciones
--                          reales vuelve a null y paper_mode a true.
--
-- Índice de un abierto por ticker: ahora por (user_id, ticker, paper), porque
-- una posición de papel no bloquea abrir el mismo ticker con dinero real.
-- ============================================================

begin;

alter table invest_positions add column if not exists paper boolean not null default false;

drop index if exists invest_positions_one_open_per_ticker;
create unique index invest_positions_one_open_per_ticker
  on invest_positions (user_id, ticker, paper) where closed_at is null;

alter table invest_settings add column if not exists paper_mode boolean not null default true;
alter table invest_settings alter column started_at drop not null;
alter table invest_settings alter column started_at drop default;

-- Usuarios sin posiciones reales: modo papel y sin fecha de inicio. Con
-- posiciones (todas reales hasta esta migración): modo real, started_at intacto.
update invest_settings s
set paper_mode = not exists (select 1 from invest_positions p where p.user_id = s.user_id and not p.paper),
    started_at = case
      when exists (select 1 from invest_positions p where p.user_id = s.user_id and not p.paper) then s.started_at
      else null
    end;

commit;
