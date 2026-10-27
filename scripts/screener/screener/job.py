"""Orquestación del run mensual (§3.2).

Todo se descarga y evalúa antes de escribir nada en Supabase. Las escrituras
no son atómicas (PostgREST, una petición por tabla): si fallan a mitad, se
relanza el job para el mismo run_date y lo rehace.
"""

from __future__ import annotations

import logging
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from typing import Any, Callable, Optional, Protocol

from . import technical as ta
from . import universe as uv
from . import yahoo
from .market_calendar import last_business_day
from .rules import FAIL_NO_DATA, ScreenResult, TickerData, evaluate

log = logging.getLogger(__name__)

DEFAULT_BENCHMARK = "IWDA.AS"
PRICE_LOOKBACK_MONTHS = 12
MAX_NO_DATA_RATIO = 0.05  # §3.3: por encima, el run se aborta sin escribir


class TooManyNoData(RuntimeError):
    """Más del 5 % del universo sin datos: probable caída de Yahoo o de la red."""

    def __init__(self, no_data: list[str], universe_size: int) -> None:
        self.no_data = no_data
        self.universe_size = universe_size
        super().__init__(
            f"{len(no_data)}/{universe_size} tickers sin datos "
            f"(> {MAX_NO_DATA_RATIO:.0%}): run abortado sin escribir"
        )


def check_no_data(results: list[ScreenResult]) -> None:
    no_data = [r.ticker for r in results if r.fail_reasons == [FAIL_NO_DATA]]
    if len(no_data) > MAX_NO_DATA_RATIO * len(results):
        raise TooManyNoData(no_data, len(results))


class Client(Protocol):
    def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]: ...
    def insert(self, table: str, rows: list[dict[str, Any]], returning: bool = False,
               on_conflict: Optional[str] = None) -> list[dict[str, Any]]: ...
    def insert_chunked(self, table: str, rows: list[dict[str, Any]], size: int = 500,
                       **kwargs: Any) -> None: ...
    def update(self, table: str, filters: dict[str, str], values: dict[str, Any]) -> list[dict[str, Any]]: ...
    def delete(self, table: str, filters: dict[str, str]) -> None: ...


@dataclass
class RunOutcome:
    run_date: date
    benchmark: str
    universe_size: int
    results: list[ScreenResult]
    checks: list[dict[str, Any]]
    sell_by_user: Counter[str] = field(default_factory=Counter)
    skipped_checks: list[str] = field(default_factory=list)

    @property
    def passed(self) -> list[ScreenResult]:
        return [r for r in self.results if r.passes]


def choose_benchmark(settings: list[dict[str, Any]]) -> str:
    """Benchmark de rel_strength_6m: el más usado en invest_settings; IWDA.AS si no hay filas."""
    counts = Counter(s["benchmark_ticker"] for s in settings if s.get("benchmark_ticker"))
    if not counts:
        return DEFAULT_BENCHMARK
    top = max(counts.values())
    return sorted(t for t, n in counts.items() if n == top)[0]


def months_before(d: date, months: int) -> date:
    return date.fromisoformat(ta.shift_month(ta.month_key(d), -months) + "-01")


def price_rows(
    ticker: str, adj_closes: dict[str, float], closes: dict[str, float]
) -> list[dict[str, Any]]:
    """Filas de invest_prices: adj_close y close (sin ajustar; null si falta ese mes)."""
    rows = []
    for key, value in sorted(adj_closes.items()):
        month_end = last_business_day(int(key[:4]), int(key[5:7]))
        close = closes.get(key)
        rows.append({
            "ticker": ticker,
            "month_end": month_end.isoformat(),
            "adj_close": round(value, 4),
            "close": None if close is None else round(close, 4),
        })
    return rows


def build_checks(
    open_positions: list[dict[str, Any]], results_by_ticker: dict[str, ScreenResult]
) -> tuple[list[dict[str, Any]], Counter[str], list[str]]:
    """Filas de invest_position_checks a partir de evaluate() (§1.4).

    Una posición sin precio o sin sma10m en el run no recibe check (la tabla
    exige ambos) y se lista en el resumen.
    """
    checks: list[dict[str, Any]] = []
    sell_by_user: Counter[str] = Counter()
    skipped: list[str] = []
    for position in open_positions:
        result = results_by_ticker.get(position["ticker"])
        if result is None or result.sma_exit is None:
            skipped.append(position["ticker"])
            continue
        signal = "sell" if result.sma_exit else "hold"
        if signal == "sell":
            sell_by_user[position["user_id"]] += 1
        checks.append(
            {"position_id": position["id"], "price": result.price, "sma10m": result.sma10m, "signal": signal}
        )
    return checks, sell_by_user, skipped


def write_run(client: Client, outcome: RunOutcome, job_version: str) -> str:
    """Escribe run + resultados + checks. Un run_date existente se reutiliza (mismo id).

    invest_positions.run_id no tiene on delete cascade, así que no se borra la
    fila del run: se actualiza y se rehacen sus resultados y checks.
    """
    run_values = {
        "executed_at": datetime.now(timezone.utc).isoformat(),
        "universe_size": outcome.universe_size,
        "passed_count": len(outcome.passed),
        "benchmark": outcome.benchmark,
        "job_version": job_version,
    }
    existing = client.select(
        "invest_screen_runs", {"select": "id", "run_date": f"eq.{outcome.run_date.isoformat()}"}
    )
    if existing:
        run_id = existing[0]["id"]
        client.update("invest_screen_runs", {"id": f"eq.{run_id}"}, run_values)
        client.delete("invest_screen_results", {"run_id": f"eq.{run_id}"})
        client.delete("invest_position_checks", {"run_id": f"eq.{run_id}"})
        log.info("run %s ya existía (%s): se rehace", outcome.run_date, run_id)
    else:
        created = client.insert(
            "invest_screen_runs", [{"run_date": outcome.run_date.isoformat(), **run_values}], returning=True
        )
        run_id = created[0]["id"]

    client.insert_chunked(
        "invest_screen_results", [{"run_id": run_id, **r.to_db_row()} for r in outcome.results]
    )
    if outcome.checks:
        client.insert("invest_position_checks", [{"run_id": run_id, **c} for c in outcome.checks])
    return run_id


def render_summary(outcome: RunOutcome) -> str:
    passed = sorted(r.ticker for r in outcome.passed)
    no_data = sum(1 for r in outcome.results if r.fail_reasons == [FAIL_NO_DATA])
    lines = [
        f"## Invest screener — {outcome.run_date.isoformat()}",
        "",
        f"- Benchmark: `{outcome.benchmark}`",
        f"- Universo: {outcome.universe_size} (sin datos: {no_data})",
        f"- Pasan: {len(passed)}",
        "",
        "### Aprobados",
        ", ".join(f"`{t}`" for t in passed) if passed else "_ninguno_",
        "",
        "### Señales sell",
    ]
    if outcome.sell_by_user:
        for i, (_, count) in enumerate(sorted(outcome.sell_by_user.items()), start=1):
            lines.append(f"- Usuario {i}: {count}")
    else:
        lines.append("_ninguna_")
    if outcome.skipped_checks:
        lines += ["", f"Posiciones sin check (falta precio o sma10m): {len(outcome.skipped_checks)}"]
    return "\n".join(lines) + "\n"


def run(
    run_date: date,
    client: Optional[Client],
    job_version: str,
    limit: Optional[int] = None,
    pause: float = 0.3,
    fetch_ticker: Callable[[str, str, dict[str, float]], TickerData] = yahoo.fetch_ticker,
) -> RunOutcome:
    t = ta.month_key(run_date)

    settings = client.select("invest_settings", {"select": "benchmark_ticker,started_at"}) if client else []
    positions = (
        client.select("invest_positions", {"select": "id,user_id,ticker,opened_at,closed_at"}) if client else []
    )
    open_positions = [p for p in positions if p["closed_at"] is None]

    # Benchmark (§3.2 paso 3). Sin él no hay rel_strength_6m: se aborta.
    benchmark = choose_benchmark(settings)
    bench_closes = yahoo.fetch_monthly(benchmark, t)
    if t not in bench_closes:
        raise RuntimeError(f"benchmark {benchmark} sin cierre para {t}")

    # Universo + evaluación (§3.2 pasos 2 y 4).
    tickers = uv.build_universe(uv.sp500_tickers(), uv.extra_tickers())
    if limit is not None:
        tickers = tickers[:limit]
    fx_rates = yahoo.load_fx_rates(t)
    missing_fx = sorted(set(yahoo.FX_TICKERS) - set(fx_rates))
    if missing_fx:
        log.warning("sin tipo de cambio para %s: sus market_cap quedan null", missing_fx)

    results: list[ScreenResult] = []
    for i, ticker in enumerate(tickers, start=1):
        results.append(evaluate(fetch_ticker(ticker, t, fx_rates), bench_closes, run_date))
        if i % 50 == 0:
            log.info("%d/%d evaluados", i, len(tickers))
        time.sleep(pause)
    check_no_data(results)
    results_by_ticker = {r.ticker: r for r in results}

    # Posiciones abiertas fuera del universo (p. ej. salió del S&P 500): se
    # evalúan solo para su check; no entran en invest_screen_results.
    for ticker in sorted({p["ticker"] for p in open_positions} - set(results_by_ticker)):
        results_by_ticker[ticker] = evaluate(fetch_ticker(ticker, t, fx_rates), bench_closes, run_date)
        time.sleep(pause)

    checks, sell_by_user, skipped = build_checks(open_positions, results_by_ticker)
    outcome = RunOutcome(
        run_date=run_date,
        benchmark=benchmark,
        universe_size=len(tickers),
        results=results,
        checks=checks,
        sell_by_user=sell_by_user,
        skipped_checks=skipped,
    )
    if client is None:
        return outcome

    write_run(client, outcome, job_version)

    # invest_prices (§2.5): benchmarks de todos los usuarios + tickers con
    # alguna posición, desde 12 meses antes de started_at / primera apertura.
    starts: dict[str, date] = {}
    for s in settings:
        # started_at es null en modo papel (§1.6): el benchmark desde run_date − 12 m.
        started = min(date.fromisoformat(s["started_at"]), run_date) if s.get("started_at") else run_date
        starts[s["benchmark_ticker"]] = min(starts.get(s["benchmark_ticker"], started), started)
    starts.setdefault(benchmark, run_date)
    for p in positions:
        opened = date.fromisoformat(p["opened_at"])
        starts[p["ticker"]] = min(starts.get(p["ticker"], opened), opened)
    # Pares EUR{divisa}=X para que la app valore el satélite en EUR (§5), desde
    # el inicio más antiguo de todo lo anterior.
    earliest = min(starts.values())
    for pair in sorted(set(yahoo.EUR_FX_TICKERS.values())):
        starts.setdefault(pair, earliest)
    for ticker, start in sorted(starts.items()):
        try:
            adj, closes = yahoo.fetch_monthly_prices(ticker, t, start=months_before(start, PRICE_LOOKBACK_MONTHS))
        except Exception as exc:  # noqa: BLE001 — un ticker sin precios no tumba el run
            log.warning("invest_prices %s: %s", ticker, exc)
            continue
        client.insert_chunked("invest_prices", price_rows(ticker, adj, closes), on_conflict="ticker,month_end")

    return outcome
