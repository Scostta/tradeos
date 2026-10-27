from __future__ import annotations

from screener.history import fundamentals_history, ticker_row
from screener.rules import TickerData


def make(**overrides) -> TickerData:
    base = dict(
        ticker="XYZ",
        name="XYZ Corp",
        income={
            "Total Revenue": [200.0, 160.0, 150.0, 120.0, 100.0],
            "Gross Profit": [120.0, 88.0, 75.0, 60.0, 50.0],
            "EBIT": [60.0, 40.0, 30.0, 20.0, 10.0],
            "EBITDA": [70.0, 50.0, 40.0, 30.0, 20.0],
        },
        cashflow={"Free Cash Flow": [40.0, 30.0, 20.0]},
        balance={
            "Total Debt": [50.0, float("nan"), 30.0],
            "Stockholders Equity": [300.0, 250.0, 200.0],
            "Cash And Cash Equivalents": [100.0, 80.0, 60.0],
        },
        fiscal_years={
            "income": [2025, 2024, 2023, 2022, 2021],
            "cashflow": [2025, 2024, 2023],
            "balance": [2025, 2024, 2023],
        },
    )
    base.update(overrides)
    return TickerData(**base)


def test_four_most_recent_fiscal_years_aligned_by_year():
    rows = fundamentals_history(make())
    assert [r["fiscal_year"] for r in rows] == [2025, 2024, 2023, 2022]
    r25, r24, r23, r22 = rows
    assert r25["revenue"] == 200 and r25["fcf"] == 40 and r25["gross_margin"] == 0.6
    # ROIC 2025 = 60 × 0,79 / (50 + 300 − 100) = 0,1896
    assert r25["roic"] == 0.1896
    # Deuda neta / EBITDA 2025 = (50 − 100) / 70
    assert r25["net_debt_ebitda"] == round(-50 / 70, 4)
    # 2024: TotalDebt NaN en un balance cargado → 0 (misma excepción que §1.2)
    assert r24["roic"] == round(40 * 0.79 / (0 + 250 - 80), 4)
    assert r23["gross_margin"] == 0.5
    # 2022: sin flujo de caja ni balance de ese año → null, sin inventar
    assert r22["revenue"] == 120 and r22["fcf"] is None and r22["roic"] is None and r22["net_debt_ebitda"] is None


def test_years_follow_each_statement_dates_not_positions():
    # El balance trae un año menos reciente: se alinea por año, no por posición.
    data = make(
        balance={"Total Debt": [30.0], "Stockholders Equity": [200.0], "Cash And Cash Equivalents": [60.0]},
        fiscal_years={"income": [2025, 2024, 2023, 2022, 2021], "cashflow": [2025, 2024, 2023], "balance": [2023]},
    )
    rows = {r["fiscal_year"]: r for r in fundamentals_history(data)}
    assert rows[2025]["roic"] is None
    assert rows[2023]["roic"] == round(30 * 0.79 / (30 + 200 - 60), 4)


def test_no_data_ticker_has_no_history():
    assert fundamentals_history(TickerData(ticker="BAD", error="boom")) == []


def test_ticker_row():
    row = ticker_row(make(sector="Technology", industry="Semiconductors", summary="Makes chips.", financial_currency="USD"), "2026-10-28T00:00:00Z")
    assert row == {
        "ticker": "XYZ", "name": "XYZ Corp", "exchange": None, "currency": None, "financial_currency": "USD",
        "sector": "Technology", "industry": "Semiconductors", "summary": "Makes chips.",
        "updated_at": "2026-10-28T00:00:00Z",
    }
