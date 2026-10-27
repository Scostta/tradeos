"""Acceso a los estados financieros de yfinance y ratios de §1.2.

Los estados se guardan como {nombre de fila: [valor último año fiscal,
anterior, ...]}. yfinance cambia los nombres de fila con cierta frecuencia, así
que todos los accesos pasan por FIELD_ALIASES. Los alias son solo variantes de
nombre del MISMO concepto ("Total Revenue" / "TotalRevenue"), nunca un cálculo
alternativo: si ningún alias existe, el valor es None y el ratio queda null.
"""

from __future__ import annotations

import logging
import math
from typing import Mapping, Optional, Sequence

log = logging.getLogger(__name__)

Statement = Mapping[str, Sequence[Optional[float]]]

FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "TotalRevenue": ("Total Revenue", "TotalRevenue"),
    "GrossProfit": ("Gross Profit", "GrossProfit"),
    "EBIT": ("EBIT",),
    "EBITDA": ("EBITDA",),
    "FreeCashFlow": ("Free Cash Flow", "FreeCashFlow"),
    "TotalDebt": ("Total Debt", "TotalDebt"),
    "StockholdersEquity": ("Stockholders Equity", "StockholdersEquity"),
    "CashAndCashEquivalents": ("Cash And Cash Equivalents", "CashAndCashEquivalents"),
}

TAX_RATE = 0.21


def get_field(
    statement: Statement, field: str, year_index: int = 0, ticker: str = ""
) -> Optional[float]:
    """Valor de `field` en el año `year_index` (0 = último año fiscal)."""
    for alias in FIELD_ALIASES[field]:
        if alias in statement:
            values = statement[alias]
            if year_index >= len(values):
                return None
            value = values[year_index]
            if value is None or math.isnan(value):
                return None
            return float(value)
    log.info("%s: campo %s no encontrado (alias %s)", ticker, field, FIELD_ALIASES[field])
    return None


def ratio(numerator: Optional[float], denominator: Optional[float]) -> Optional[float]:
    """num / den; None si falta alguno o el denominador es <= 0."""
    if numerator is None or denominator is None or denominator <= 0:
        return None
    return numerator / denominator


def revenue_growth_yoy(income: Statement, ticker: str = "") -> Optional[float]:
    growth = ratio(
        get_field(income, "TotalRevenue", 0, ticker),
        get_field(income, "TotalRevenue", 1, ticker),
    )
    return None if growth is None else growth - 1


def fcf_margin(income: Statement, cashflow: Statement, ticker: str = "") -> Optional[float]:
    return ratio(
        get_field(cashflow, "FreeCashFlow", 0, ticker),
        get_field(income, "TotalRevenue", 0, ticker),
    )


def gross_margin(income: Statement, year_index: int, ticker: str = "") -> Optional[float]:
    return ratio(
        get_field(income, "GrossProfit", year_index, ticker),
        get_field(income, "TotalRevenue", year_index, ticker),
    )


def net_debt(balance: Statement, ticker: str = "") -> Optional[float]:
    debt = get_field(balance, "TotalDebt", 0, ticker)
    cash = get_field(balance, "CashAndCashEquivalents", 0, ticker)
    if debt is None or cash is None:
        return None
    return debt - cash


def net_debt_ebitda(income: Statement, balance: Statement, ticker: str = "") -> Optional[float]:
    """Deuda neta / EBITDA. None con EBITDA <= 0 (el ratio no tiene sentido)."""
    return ratio(net_debt(balance, ticker), get_field(income, "EBITDA", 0, ticker))


def roic(income: Statement, balance: Statement, ticker: str = "") -> Optional[float]:
    """EBIT × (1 − 0,21) / (TotalDebt + StockholdersEquity − Cash).

    None si falta algún campo o el capital invertido es <= 0.
    """
    ebit = get_field(income, "EBIT", 0, ticker)
    debt = get_field(balance, "TotalDebt", 0, ticker)
    equity = get_field(balance, "StockholdersEquity", 0, ticker)
    cash = get_field(balance, "CashAndCashEquivalents", 0, ticker)
    if ebit is None or debt is None or equity is None or cash is None:
        return None
    return ratio(ebit * (1 - TAX_RATE), debt + equity - cash)
