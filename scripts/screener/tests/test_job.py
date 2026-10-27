from __future__ import annotations

from collections import Counter
from datetime import date
from typing import Any, Optional

import pytest

from screener import job
from screener.rules import ScreenResult, TickerData

from .conftest import FIXTURE_RUN_DATE, load_ticker


class FakeClient:
    """PostgREST en memoria: solo lo que usa job.run()."""

    def __init__(self, settings=None, positions=None, runs=None) -> None:
        self.tables: dict[str, list[dict[str, Any]]] = {
            "invest_settings": settings or [],
            "invest_positions": positions or [],
            "invest_screen_runs": runs or [],
            "invest_screen_results": [],
            "invest_position_checks": [],
            "invest_prices": [],
            "invest_tickers": [],
            "invest_fundamentals_history": [],
        }
        self.calls: list[tuple[str, str]] = []

    def select(self, table, params):
        self.calls.append(("select", table))
        rows = self.tables[table]
        if "run_date" in params:
            rows = [r for r in rows if r["run_date"] == params["run_date"].removeprefix("eq.")]
        return [dict(r) for r in rows]

    def insert(self, table, rows, returning: bool = False, on_conflict: Optional[str] = None):
        self.calls.append(("insert", table))
        if table == "invest_screen_runs":
            rows = [{"id": f"run-{len(self.tables[table]) + 1}", **r} for r in rows]
        if on_conflict:  # upsert: reemplaza la fila con la misma clave
            keys = on_conflict.split(",")
            for row in rows:
                same = lambda r: all(r[k] == row[k] for k in keys)
                self.tables[table] = [r for r in self.tables[table] if not same(r)] + [row]
            return []
        self.tables[table].extend(rows)
        return rows if returning else []

    def insert_chunked(self, table, rows, size: int = 500, **kwargs):
        self.insert(table, rows, **kwargs)

    def update(self, table, filters, values):
        self.calls.append(("update", table))
        run_id = filters["id"].removeprefix("eq.")
        for row in self.tables[table]:
            if row["id"] == run_id:
                row.update(values)
        return []

    def delete(self, table, filters):
        self.calls.append(("delete", table))
        if table == "invest_screen_runs":
            raise AssertionError("un rerun no debe borrar la fila del run")
        run_id = filters["run_id"].removeprefix("eq.")
        self.tables[table] = [r for r in self.tables[table] if r["run_id"] != run_id]


@pytest.fixture
def offline(monkeypatch, benchmark):
    """Sustituye Yahoo y Wikipedia por los fixtures."""
    fetched_monthly: list[tuple[str, Optional[date]]] = []

    def fetch_monthly(ticker, through, start=None):
        fetched_monthly.append((ticker, start))
        if ticker.endswith("=X"):
            return {"2026-08": 1.1, "2026-09": 1.2}
        return dict(benchmark) if ticker == "IWDA.AS" else dict(load_ticker(ticker).closes)

    def fetch_monthly_prices(ticker, through, start=None):
        adj = fetch_monthly(ticker, through, start)
        # Sin ajustar: algo por encima del ajustado (dividendos posteriores), salvo FX.
        return adj, {k: v if ticker.endswith("=X") else v * 1.01 for k, v in adj.items()}

    monkeypatch.setattr(job.yahoo, "fetch_monthly", fetch_monthly)
    monkeypatch.setattr(job.yahoo, "fetch_monthly_prices", fetch_monthly_prices)
    monkeypatch.setattr(job.yahoo, "load_fx_rates", lambda through: {"USD": 1.0})
    monkeypatch.setattr(job.uv, "sp500_tickers", lambda: ["GOOGL", "AAPL"])
    monkeypatch.setattr(job.uv, "extra_tickers", lambda: ["AAPL"])
    return fetched_monthly


def fetch_fixture(ticker, through, fx_rates):
    return load_ticker(ticker)


POSITIONS = [
    {"id": "p1", "user_id": "u1", "ticker": "COST", "opened_at": "2026-03-02", "closed_at": None},
    {"id": "p2", "user_id": "u1", "ticker": "GOOGL", "opened_at": "2026-05-01", "closed_at": None},
    {"id": "p3", "user_id": "u2", "ticker": "AAPL", "opened_at": "2025-11-03", "closed_at": "2026-02-02"},
]


def run(client):
    return job.run(FIXTURE_RUN_DATE, client, "sha123", pause=0, fetch_ticker=fetch_fixture)


def test_run_writes_run_results_checks_and_prices(offline):
    client = FakeClient(
        settings=[{"benchmark_ticker": "IWDA.AS", "started_at": "2026-04-01"}], positions=POSITIONS
    )
    outcome = run(client)

    # Universo deduplicado; COST (posición abierta fuera del universo) no entra en results.
    assert outcome.universe_size == 2
    assert [r["ticker"] for r in client.tables["invest_screen_results"]] == ["GOOGL", "AAPL"]
    (run_row,) = client.tables["invest_screen_runs"]
    assert run_row["run_date"] == "2026-09-30"
    assert run_row["passed_count"] == 1 and run_row["benchmark"] == "IWDA.AS"
    assert run_row["job_version"] == "sha123"
    assert all(r["run_id"] == run_row["id"] for r in client.tables["invest_screen_results"])

    # Checks solo de posiciones abiertas; COST está bajo su sma10m → sell.
    checks = {c["position_id"]: c["signal"] for c in client.tables["invest_position_checks"]}
    assert checks == {"p1": "sell", "p2": "hold"}
    assert outcome.sell_by_user == Counter({"u1": 1})

    # Precios: benchmark desde 36 meses antes de run_date (o 12 antes de started_at si es antes), tickers desde 12
    # meses antes de su primera apertura (abiertas y cerradas). Los pares FX a
    # EUR, desde el más antiguo de esos inicios.
    starts = dict((t, s) for t, s in offline if s is not None)
    fx_pairs = {"EURUSD=X", "EURGBP=X", "EURCHF=X", "EURSEK=X", "EURDKK=X", "EURNOK=X"}
    assert starts == {
        "IWDA.AS": date(2023, 9, 1),   # benchmark: 36 meses para la página de detalle
        "COST": date(2025, 3, 1),
        "GOOGL": date(2025, 5, 1),
        "AAPL": date(2024, 11, 1),
        **{pair: date(2024, 11, 1) for pair in fx_pairs},
    }
    priced = {p["ticker"] for p in client.tables["invest_prices"]}
    assert priced == {"IWDA.AS", "COST", "GOOGL", "AAPL"} | fx_pairs
    assert {"ticker": "EURUSD=X", "month_end": "2026-09-30", "adj_close": 1.2, "close": 1.2} in client.tables["invest_prices"]
    # El cierre sin ajustar se guarda junto al ajustado.
    googl_sep = next(p for p in client.tables["invest_prices"] if p["ticker"] == "GOOGL" and p["month_end"] == "2026-09-30")
    assert abs(googl_sep["close"] - googl_sep["adj_close"] * 1.01) < 1e-3
    assert {"ticker": "IWDA.AS", "month_end": "2026-09-30"} in [
        {k: p[k] for k in ("ticker", "month_end")} for p in client.tables["invest_prices"]
    ]


def test_paper_mode_settings_without_started_at(offline):
    """§1.6: en modo papel started_at es null; el benchmark se pide desde run_date − 12 m."""
    client = FakeClient(settings=[{"benchmark_ticker": "IWDA.AS", "started_at": None}])
    run(client)
    starts = dict((t, s) for t, s in offline if s is not None)
    assert starts["IWDA.AS"] == date(2023, 9, 1)
    assert {p["ticker"] for p in client.tables["invest_prices"]} >= {"IWDA.AS"}


def test_run_writes_detail_data_for_every_loaded_ticker(offline):
    """invest_tickers, invest_fundamentals_history y 36 meses de precios de todo el universo."""
    client = FakeClient()
    run(client)
    assert {r["ticker"] for r in client.tables["invest_tickers"]} == {"GOOGL", "AAPL"}
    googl = next(r for r in client.tables["invest_tickers"] if r["ticker"] == "GOOGL")
    assert googl["name"] == "Alphabet Inc." and googl["updated_at"]
    # Las fixtures no traen años fiscales: sin historia, pero sin error.
    assert client.tables["invest_fundamentals_history"] == []
    months = sorted(p["month_end"] for p in client.tables["invest_prices"] if p["ticker"] == "AAPL")
    assert months[-1] == "2026-09-30"
    assert months[0] >= "2023-10-01"   # como mucho 36 cierres hasta t


def test_rerun_reuses_run_row_and_replaces_results(offline):
    client = FakeClient(positions=POSITIONS)
    run(client)
    first_id = client.tables["invest_screen_runs"][0]["id"]
    run(client)

    assert [r["id"] for r in client.tables["invest_screen_runs"]] == [first_id]
    assert len(client.tables["invest_screen_results"]) == 2
    assert len(client.tables["invest_position_checks"]) == 2
    assert ("update", "invest_screen_runs") in client.calls


def test_dry_run_does_not_need_client(offline):
    outcome = run(None)
    assert [r.ticker for r in outcome.passed] == ["GOOGL"]
    assert outcome.checks == []


def test_run_aborts_without_benchmark_close(monkeypatch, offline):
    monkeypatch.setattr(job.yahoo, "fetch_monthly", lambda ticker, through, start=None: {"2026-08": 1.0})
    with pytest.raises(RuntimeError, match="benchmark"):
        run(FakeClient())


def test_choose_benchmark():
    assert job.choose_benchmark([]) == "IWDA.AS"
    assert job.choose_benchmark([{"benchmark_ticker": "VWCE.DE"}]) == "VWCE.DE"
    settings = [{"benchmark_ticker": t} for t in ["VWCE.DE", "IWDA.AS", "VWCE.DE"]]
    assert job.choose_benchmark(settings) == "VWCE.DE"


def test_position_without_price_gets_no_check():
    results = {"XYZ": ScreenResult(ticker="XYZ", fail_reasons=["no_data"])}
    checks, sells, skipped = job.build_checks(
        [{"id": "p", "user_id": "u", "ticker": "XYZ", "closed_at": None}], results
    )
    assert checks == [] and not sells and skipped == ["XYZ"]


def test_summary_has_counts_but_no_user_ids(offline):
    outcome = run(FakeClient(positions=POSITIONS))
    summary = job.render_summary(outcome)
    assert "2026-09-30" in summary and "Pasan: 1" in summary and "`GOOGL`" in summary
    assert "Usuario 1: 1" in summary
    assert "u1" not in summary and "u2" not in summary


def test_price_rows_use_last_business_day():
    rows = job.price_rows("X", {"2026-05": 10.123456, "2029-03": 20.0}, {"2026-05": 10.5})
    assert rows == [
        {"ticker": "X", "month_end": "2026-05-29", "adj_close": 10.1235, "close": 10.5},
        {"ticker": "X", "month_end": "2029-03-29", "adj_close": 20.0, "close": None},
    ]


# ── §3.3: no_data > 5 % del universo → abortar sin escribir ──────────────────


def universe_of(monkeypatch, size: int, no_data: set[int]):
    tickers = [f"T{i:02d}" for i in range(size)]
    monkeypatch.setattr(job.uv, "sp500_tickers", lambda: tickers)
    monkeypatch.setattr(job.uv, "extra_tickers", lambda: [])

    def fetch(ticker, through, fx_rates):
        if int(ticker[1:]) in no_data:
            return TickerData(ticker=ticker, error="CurlError: could not resolve host")
        data = load_ticker("GOOGL")
        data.ticker = ticker
        return data

    return fetch


def test_run_aborts_without_writing_when_no_data_above_5pct(monkeypatch, offline):
    fetch = universe_of(monkeypatch, 20, no_data={3, 7})  # 2/20 = 10 %
    client = FakeClient(positions=POSITIONS)
    with pytest.raises(job.TooManyNoData) as excinfo:
        job.run(FIXTURE_RUN_DATE, client, "sha", pause=0, fetch_ticker=fetch)
    assert excinfo.value.no_data == ["T03", "T07"]
    assert {method for method, _ in client.calls} == {"select"}
    assert client.tables["invest_screen_runs"] == []
    assert client.tables["invest_prices"] == []


def test_run_writes_when_no_data_is_exactly_5pct(monkeypatch, offline):
    fetch = universe_of(monkeypatch, 20, no_data={3})  # 1/20 = 5 %, no supera
    client = FakeClient()
    outcome = job.run(FIXTURE_RUN_DATE, client, "sha", pause=0, fetch_ticker=fetch)
    assert len(client.tables["invest_screen_results"]) == 20
    assert "sin datos: 1" in job.render_summary(outcome)


def test_main_exits_1_and_writes_summary_on_abort(monkeypatch, tmp_path):
    from screener import __main__ as cli

    def boom(*args, **kwargs):
        raise job.TooManyNoData(["T03", "T07"], 20)

    summary = tmp_path / "summary.md"
    monkeypatch.setenv("GITHUB_STEP_SUMMARY", str(summary))
    monkeypatch.setattr(cli, "run", boom)
    assert cli.main(["--force", "--dry-run", "--run-date", "2026-09-30"]) == 1
    text = summary.read_text(encoding="utf-8")
    assert "ABORTADO" in text and "2/20" in text and "`T07`" in text
