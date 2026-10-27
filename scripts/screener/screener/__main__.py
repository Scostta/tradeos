"""CLI: python -m screener [--run-date YYYY-MM-DD] [--force] [--dry-run] [--limit N]

- Sin --force solo corre el primer día hábil (NYSE) del mes; el resto de días
  sale con código 0 sin hacer nada (el cron cae los días 1–4).
- workflow_dispatch pasa --force: corre siempre.
- --run-date por defecto: último día hábil del mes anterior.
- Sale con código 1 si más del 5 % del universo queda sin datos (no escribe).
"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import warnings
from datetime import date, datetime, timezone

from .job import TooManyNoData, render_summary, run
from .market_calendar import first_business_day, last_business_day, previous_month_run_date
from .supabase_rest import SupabaseRest


def parse_run_date(value: str, today: date) -> date:
    run_date = date.fromisoformat(value)
    expected = last_business_day(run_date.year, run_date.month)
    if run_date != expected:
        raise SystemExit(f"run_date {run_date} no es el último día hábil de su mes ({expected})")
    if run_date >= today:
        raise SystemExit(f"run_date {run_date} no es un cierre mensual pasado")
    return run_date


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="screener")
    parser.add_argument("--run-date", help="cierre mensual a evaluar (YYYY-MM-DD)")
    parser.add_argument("--force", action="store_true", help="saltar el check de primer día hábil")
    parser.add_argument("--dry-run", action="store_true", help="no lee ni escribe en Supabase")
    parser.add_argument("--limit", type=int, help="solo los N primeros tickers (pruebas)")
    parser.add_argument("--pause", type=float, default=0.3, help="segundos entre tickers")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    logging.getLogger("yfinance").setLevel(logging.CRITICAL)
    warnings.filterwarnings("ignore", module="yfinance")

    today = datetime.now(timezone.utc).date()
    if not args.force and today != first_business_day(today.year, today.month):
        print(f"{today} no es el primer día hábil del mes: nada que hacer")
        return 0

    run_date = parse_run_date(args.run_date, today) if args.run_date else previous_month_run_date(today)

    client = None
    if not args.dry_run:
        url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            print("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
            return 1
        client = SupabaseRest(url, key)

    job_version = os.environ.get("JOB_VERSION") or os.environ.get("GITHUB_SHA") or "local"
    try:
        outcome = run(run_date, client, job_version, limit=args.limit, pause=args.pause)
    except TooManyNoData as exc:
        write_summary(
            f"## Invest screener — {run_date.isoformat()} ABORTADO\n\n{exc}\n\n"
            f"Sin datos: {', '.join(f'`{t}`' for t in exc.no_data)}\n"
        )
        return 1

    write_summary(render_summary(outcome))
    return 0


def write_summary(summary: str) -> None:
    print(summary)
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as f:
            f.write(summary)


if __name__ == "__main__":
    sys.exit(main())
