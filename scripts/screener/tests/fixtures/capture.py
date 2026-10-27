"""Captura fixtures JSON reales de Yahoo para los tests.

    cd scripts/screener
    python -m tests.fixtures.capture 2026-09-30 MSFT LULU ...   # escribe tests/fixtures/<TICKER>.json
    python -m tests.fixtures.capture 2026-09-30 --benchmark IWDA.AS

Guarda los datos crudos (TickerData) tal como salen de yahoo.fetch_ticker(),
con los nombres de campo que devuelve yfinance, sin evaluar.
"""

from __future__ import annotations

import json
import sys
from dataclasses import asdict
from datetime import date
from pathlib import Path

from screener import technical as ta
from screener import yahoo
from screener.rules import evaluate

FIXTURES = Path(__file__).resolve().parent


def main(argv: list[str]) -> None:
    run_date = date.fromisoformat(argv[0])
    t = ta.month_key(run_date)
    if argv[1] == "--benchmark":
        ticker = argv[2]
        closes = yahoo.fetch_monthly(ticker, t)
        payload = {"ticker": ticker, "run_date": run_date.isoformat(), "closes": closes}
        (FIXTURES / f"benchmark_{ticker}.json").write_text(json.dumps(payload, indent=1))
        return
    bench = json.loads((FIXTURES / "benchmark_IWDA.AS.json").read_text())["closes"]
    fx = yahoo.load_fx_rates(t)
    for ticker in argv[1:]:
        data = yahoo.fetch_ticker(ticker, t, fx)
        result = evaluate(data, bench, run_date)
        print(ticker, "PASS" if result.passes else result.fail_reasons)
        payload = {"run_date": run_date.isoformat(), **asdict(data)}
        (FIXTURES / f"{ticker}.json").write_text(json.dumps(payload, indent=1))


if __name__ == "__main__":
    main(sys.argv[1:])
