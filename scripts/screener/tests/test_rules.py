from __future__ import annotations

from datetime import date

import pytest

from screener.rules import TickerData, evaluate
from screener.technical import shift_month

from .conftest import FIXTURE_RUN_DATE

RUN_DATE = date(2026, 9, 30)
T = "2026-09"


def rising(months: int = 24, step: float = 0.01) -> dict[str, float]:
    return {shift_month(T, -i): 100 * (1 + step) ** (months - 1 - i) for i in range(months)}


FLAT_BENCHMARK = {shift_month(T, -i): 100.0 for i in range(24)}


def make_row(**overrides) -> TickerData:
    """Ticker sintético que pasa todas las reglas.

    growth 120/100-1 = 0.20 · fcf 20/120 · gm 60/120 = 50/100 · net debt 20 / EBITDA 40 = 0.5
    roic 30×0.79 / (50+100−30) = 0.1975 · precio subiendo 1 %/mes vs benchmark plano.
    """
    base = dict(
        ticker="TEST",
        name="Test Corp",
        exchange="NMS",
        currency="USD",
        market_cap_usd=3e9,
        income={
            "Total Revenue": [120.0, 100.0],
            "Gross Profit": [60.0, 50.0],
            "EBIT": [30.0, 25.0],
            "EBITDA": [40.0, 35.0],
        },
        cashflow={"Free Cash Flow": [20.0, 15.0]},
        balance={
            "Total Debt": [50.0, 50.0],
            "Stockholders Equity": [100.0, 90.0],
            "Cash And Cash Equivalents": [30.0, 30.0],
        },
        closes=rising(),
    )
    base.update(overrides)
    return TickerData(**base)


def with_field(statement_name: str, field: str, values, **overrides) -> TickerData:
    row = make_row(**overrides)
    statement = dict(getattr(row, statement_name))
    if values is None:
        del statement[field]
    else:
        statement[field] = values
    setattr(row, statement_name, statement)
    return row


def reasons(row: TickerData, benchmark=FLAT_BENCHMARK) -> list[str]:
    return evaluate(row, benchmark, RUN_DATE).fail_reasons


# ── Fixtures reales (yfinance, run_date 2026-09-30) ─────────────────────────


def test_fixture_googl_passes(fixture_ticker, benchmark):
    result = evaluate(fixture_ticker("GOOGL"), benchmark, FIXTURE_RUN_DATE)
    assert result.fail_reasons == []
    assert result.passes and result.passes_fundamental and result.passes_technical
    assert result.months_listed >= 12 and result.market_cap > 2e9
    assert result.sma_exit is False


def test_fixture_aapl_fails_fundamental_only(fixture_ticker, benchmark):
    result = evaluate(fixture_ticker("AAPL"), benchmark, FIXTURE_RUN_DATE)
    assert result.fail_reasons == ["revenue_growth"]
    assert result.revenue_growth_yoy is not None and result.revenue_growth_yoy <= 0.10
    assert not result.passes_fundamental and result.passes_technical and not result.passes


def test_fixture_cost_fails_technical_only(fixture_ticker, benchmark):
    result = evaluate(fixture_ticker("COST"), benchmark, FIXTURE_RUN_DATE)
    assert result.fail_reasons == ["sma10m", "rel_strength_6m"]
    assert result.price < result.sma10m and result.sma_exit is True
    assert result.passes_fundamental and not result.passes_technical and not result.passes


def test_fixture_camelcase_alias_gives_same_result(fixture_ticker, benchmark):
    row = fixture_ticker("GOOGL")
    row.income = {k.replace(" ", ""): v for k, v in row.income.items()}
    row.cashflow = {k.replace(" ", ""): v for k, v in row.cashflow.items()}
    row.balance = {k.replace(" ", ""): v for k, v in row.balance.items()}
    assert evaluate(row, benchmark, FIXTURE_RUN_DATE) == evaluate(
        fixture_ticker("GOOGL"), benchmark, FIXTURE_RUN_DATE
    )


def test_fixture_unknown_field_name_is_null_not_fallback(fixture_ticker, benchmark):
    """Si yfinance renombra un campo a algo no listado en FIELD_ALIASES, el ratio
    queda null y falla; no se busca un sustituto."""
    row = fixture_ticker("GOOGL")
    row.cashflow = {("FCF" if k == "Free Cash Flow" else k): v for k, v in row.cashflow.items()}
    result = evaluate(row, benchmark, FIXTURE_RUN_DATE)
    assert result.fcf_margin is None
    assert result.fail_reasons == ["fcf_margin"]


# ── Caso base sintético ──────────────────────────────────────────────────────


def test_synthetic_baseline_passes():
    result = evaluate(make_row(), FLAT_BENCHMARK, RUN_DATE)
    assert result.fail_reasons == []
    assert result.revenue_growth_yoy == 0.2
    assert result.fcf_margin == pytest.approx(0.1667)
    assert result.gross_margin == 0.5 and result.gross_margin_prev == 0.5
    assert result.net_debt_ebitda == 0.5
    assert result.roic == 0.1975
    assert result.months_listed == 24


def test_no_data():
    result = evaluate(TickerData(ticker="XX", error="YFPricesMissingError"), FLAT_BENCHMARK, RUN_DATE)
    assert result.fail_reasons == ["no_data"]
    assert not (result.passes or result.passes_fundamental or result.passes_technical)


def test_empty_history_is_no_data():
    assert reasons(make_row(closes={})) == ["no_data"]


def test_db_row_has_exactly_the_table_columns():
    columns = {
        "ticker", "name", "exchange", "market_cap", "revenue_growth_yoy", "fcf_margin",
        "gross_margin", "gross_margin_prev", "net_debt_ebitda", "roic", "price", "sma10m",
        "momentum_12_1", "rel_strength_6m", "months_listed", "passes_fundamental",
        "passes_technical", "passes", "fail_reasons",
    }
    assert set(evaluate(make_row(), FLAT_BENCHMARK, RUN_DATE).to_db_row()) == columns


# ── §1.1 universo ────────────────────────────────────────────────────────────


@pytest.mark.parametrize("cap, ok", [(2_000_000_001, True), (2e9, False), (1e9, False), (None, False)])
def test_market_cap(cap, ok):
    assert ("market_cap" not in reasons(make_row(market_cap_usd=cap))) is ok


@pytest.mark.parametrize("months, ok", [(13, True), (12, True), (11, False)])
def test_months_listed(months, ok):
    result = evaluate(make_row(closes=rising(months)), FLAT_BENCHMARK, RUN_DATE)
    assert result.months_listed == months
    assert ("months_listed" not in result.fail_reasons) is ok
    assert result.passes is (ok and months >= 13)  # momentum 12-1 necesita P[t-12]


# ── §1.2 fundamental: un caso que pasa y uno que falla por regla ─────────────


@pytest.mark.parametrize(
    "revenue, ok",
    [([111.0, 100.0], True), ([110.0, 100.0], False), ([90.0, 100.0], False)],
)
def test_revenue_growth(revenue, ok):
    row = with_field("income", "Total Revenue", revenue)
    row.income = {**row.income, "Gross Profit": [revenue[0] / 2, revenue[1] / 2]}
    assert ("revenue_growth" not in reasons(row)) is ok


@pytest.mark.parametrize("fcf, ok", [([1.0], True), ([0.0], False), ([-5.0], False)])
def test_fcf_margin(fcf, ok):
    assert ("fcf_margin" not in reasons(with_field("cashflow", "Free Cash Flow", fcf))) is ok


@pytest.mark.parametrize(
    "gross_profit, ok",
    [
        ([66.0, 50.0], True),   # 0.55 vs 0.50, mejora
        ([58.8, 50.0], True),   # 0.49 vs 0.50, cae exactamente 1 punto
        ([58.68, 50.0], False),  # 0.489 vs 0.50, cae 1,1 puntos
    ],
)
def test_gross_margin(gross_profit, ok):
    assert ("gross_margin" not in reasons(with_field("income", "Gross Profit", gross_profit))) is ok


@pytest.mark.parametrize(
    "debt, cash, ebitda, expected_ratio, ok",
    [
        (50.0, 30.0, 40.0, 0.5, True),     # deuda neta 20 / 40
        (110.0, 30.0, 40.0, 2.0, False),   # exactamente 2 → falla (< 2)
        (150.0, 30.0, 40.0, 3.0, False),
        (10.0, 30.0, 40.0, -0.5, True),    # caja neta
        (10.0, 30.0, -5.0, None, True),    # caja neta con EBITDA negativo: pasa por caja neta
        (50.0, 30.0, -5.0, None, False),   # deuda neta con EBITDA <= 0: ratio null, falla
        (50.0, 30.0, 0.0, None, False),
    ],
)
def test_net_debt_ebitda(debt, cash, ebitda, expected_ratio, ok):
    row = make_row()
    row.balance = {**row.balance, "Total Debt": [debt], "Cash And Cash Equivalents": [cash]}
    row.income = {**row.income, "EBITDA": [ebitda]}
    result = evaluate(row, FLAT_BENCHMARK, RUN_DATE)
    assert result.net_debt_ebitda == expected_ratio
    assert ("net_debt_ebitda" not in result.fail_reasons) is ok


@pytest.mark.parametrize(
    "ebit, equity, expected_roic, ok",
    [
        (30.0, 100.0, 0.1975, True),
        (12.0, 100.0, 0.079, False),    # 12×0.79/120
        (30.0, -20.0, None, False),     # capital invertido 50−20−30 = 0 → null
        (30.0, -50.0, None, False),     # capital invertido negativo → null
    ],
)
def test_roic(ebit, equity, expected_roic, ok):
    row = with_field("income", "EBIT", [ebit])
    row.balance = {**row.balance, "Stockholders Equity": [equity]}
    result = evaluate(row, FLAT_BENCHMARK, RUN_DATE)
    assert result.roic == expected_roic
    assert ("roic" not in result.fail_reasons) is ok


def test_huge_ratio_out_of_numeric_range_is_null():
    row = make_row()
    row.balance = {**row.balance, "Total Debt": [1e9]}
    row.income = {**row.income, "EBITDA": [1.0]}
    result = evaluate(row, FLAT_BENCHMARK, RUN_DATE)
    assert result.net_debt_ebitda is None
    assert "net_debt_ebitda" in result.fail_reasons


# ── null en cualquier ratio → falla con su fail_reason ───────────────────────


@pytest.mark.parametrize(
    "statement, field, expected",
    [
        ("income", "Total Revenue", ["revenue_growth", "fcf_margin", "gross_margin"]),
        ("income", "Gross Profit", ["gross_margin"]),
        ("income", "EBITDA", ["net_debt_ebitda"]),
        ("income", "EBIT", ["roic"]),
        ("cashflow", "Free Cash Flow", ["fcf_margin"]),
        ("balance", "Total Debt", ["net_debt_ebitda", "roic"]),
        ("balance", "Stockholders Equity", ["roic"]),
        ("balance", "Cash And Cash Equivalents", ["net_debt_ebitda", "roic"]),
    ],
)
def test_missing_field_fails_its_rules(statement, field, expected):
    assert reasons(with_field(statement, field, None)) == expected


@pytest.mark.parametrize(
    "statement, field, values, expected",
    [
        ("income", "Total Revenue", [120.0, None], ["revenue_growth", "gross_margin"]),
        ("income", "Gross Profit", [60.0], ["gross_margin"]),  # sin año anterior
        ("balance", "Total Debt", [float("nan")], ["net_debt_ebitda", "roic"]),
    ],
)
def test_nan_or_missing_year_fails_its_rules(statement, field, values, expected):
    assert reasons(with_field(statement, field, values)) == expected


# ── §1.3 técnico ─────────────────────────────────────────────────────────────


def test_price_below_sma_fails_and_flags_exit():
    closes = rising()
    closes[T] = 80.0  # cae por debajo de la media de 10 meses
    result = evaluate(make_row(closes=closes), FLAT_BENCHMARK, RUN_DATE)
    assert "sma10m" in result.fail_reasons
    assert result.sma_exit is True


def test_price_equal_to_sma_fails_rule_but_is_not_exit():
    """La regla de entrada exige price > sma10m; la salida es price < sma10m."""
    closes = {shift_month(T, -i): 100.0 for i in range(24)}
    closes[shift_month(T, -12)] = 90.0  # momentum > 0 sin tocar la ventana de la SMA
    result = evaluate(make_row(closes=closes), {k: 90.0 for k in closes}, RUN_DATE)
    assert result.price == result.sma10m == 100.0
    assert "sma10m" in result.fail_reasons
    assert result.sma_exit is False


def test_negative_momentum_fails():
    closes = rising()
    closes[shift_month(T, -12)] = 1_000.0
    assert "momentum_12_1" in reasons(make_row(closes=closes))


def test_benchmark_outperforming_fails_rel_strength():
    strong_benchmark = rising(step=0.05)
    assert reasons(make_row(), strong_benchmark) == ["rel_strength_6m"]


@pytest.mark.parametrize(
    "drop_month, expected",
    [
        (-3, ["sma10m"]),
        (-12, ["momentum_12_1"]),
        (-6, ["sma10m", "rel_strength_6m"]),  # t-6 también está en la ventana de la SMA
        (0, ["sma10m", "rel_strength_6m"]),  # sin precio en t
    ],
)
def test_missing_month_makes_technical_null(drop_month, expected):
    closes = rising()
    del closes[shift_month(T, drop_month)]
    assert reasons(make_row(closes=closes)) == expected


def test_missing_benchmark_month_fails_rel_strength():
    benchmark = dict(FLAT_BENCHMARK)
    del benchmark[shift_month(T, -6)]
    result = evaluate(make_row(), benchmark, RUN_DATE)
    assert result.rel_strength_6m is None
    assert result.fail_reasons == ["rel_strength_6m"]
