"""Historia de fundamentales para la página de detalle (/invest/[ticker]).

Solo informativa: no interviene en evaluate() ni en las reglas de §1. Para
cada año fiscal se "recortan" los estados para que ese año quede en la
posición 0 y se reutilizan las mismas funciones de fundamentals.py (mismos
alias, misma excepción de TotalDebt, mismo criterio de denominador <= 0).
"""

from __future__ import annotations

from typing import Any, Optional

from . import fundamentals as fa
from .fundamentals import Statement
from .rules import TickerData

HISTORY_YEARS = 4
RATIO_LIMIT = 10_000  # numeric(8,4)


def _from_year(statement: Statement, years: list[int], year: int) -> Statement:
    """El estado con `year` en la posición 0; vacío si ese año no está."""
    if year not in years:
        return {}
    i = years.index(year)
    return {name: list(values[i:]) for name, values in statement.items()}


def _ratio(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    value = round(value, 4)
    return value if abs(value) < RATIO_LIMIT else None


def _amount(value: Optional[float]) -> Optional[int]:
    return None if value is None else round(value)


def fundamentals_history(row: TickerData) -> list[dict[str, Any]]:
    """Filas de invest_fundamentals_history: los últimos 4 años fiscales del
    estado de resultados (años según su fecha de cierre).

    Si la empresa cambió de cierre fiscal, dos columnas caen en el mismo año
    natural; se queda la más reciente (la que _from_year encuentra) para no
    repetir (ticker, fiscal_year) en el upsert."""
    if row.error is not None:
        return []
    income_years = row.fiscal_years.get("income", [])
    rows = []
    for year in list(dict.fromkeys(income_years))[:HISTORY_YEARS]:
        income = _from_year(row.income, income_years, year)
        cashflow = _from_year(row.cashflow, row.fiscal_years.get("cashflow", []), year)
        balance = _from_year(row.balance, row.fiscal_years.get("balance", []), year)
        rows.append({
            "ticker": row.ticker,
            "fiscal_year": year,
            "revenue": _amount(fa.get_field(income, "TotalRevenue", 0, row.ticker)),
            "gross_margin": _ratio(fa.gross_margin(income, 0, row.ticker)),
            "fcf": _amount(fa.get_field(cashflow, "FreeCashFlow", 0, row.ticker)),
            "roic": _ratio(fa.roic(income, balance, row.ticker)),
            "net_debt_ebitda": _ratio(fa.net_debt_ebitda(income, balance, row.ticker)),
        })
    return rows


def ticker_row(row: TickerData, updated_at: str) -> dict[str, Any]:
    """Fila de invest_tickers. updated_at explícito: el upsert no aplica defaults al actualizar."""
    return {
        "ticker": row.ticker,
        "name": row.name,
        "exchange": row.exchange,
        "currency": row.currency,
        "financial_currency": row.financial_currency,
        "sector": row.sector,
        "industry": row.industry,
        "summary": row.summary,
        "updated_at": updated_at,
    }
