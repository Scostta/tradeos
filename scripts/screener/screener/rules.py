"""Reglas del screener (INVEST_SPEC.md §1).

evaluate() es la ÚNICA implementación de las reglas en todo el proyecto: la app
(TS) solo lee lo que se guarda en invest_screen_results / invest_position_checks.

Un ratio que no se puede calcular (None) falla su regla. Los ratios se
redondean a 4 decimales ANTES de aplicar los umbrales, para que el valor
guardado reproduzca exactamente la decisión. Un ratio que no cabe en
numeric(8,4) (|x| >= 10000, denominador casi cero) se trata como no calculable.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import date
from typing import Any, Optional

from . import fundamentals as fa
from . import technical as ta
from .fundamentals import Statement
from .technical import MonthlySeries

MIN_MARKET_CAP_USD = 2_000_000_000
MIN_MONTHS_LISTED = 12
MIN_REVENUE_GROWTH = 0.10
MIN_FCF_MARGIN = 0.0
MAX_GROSS_MARGIN_DROP = 0.01
MAX_NET_DEBT_EBITDA = 2.0
MIN_ROIC = 0.10

RATIO_LIMIT = 10_000  # numeric(8,4)
PRICE_LIMIT = 100_000_000  # numeric(12,4)

# Vocabulario de fail_reasons, en el orden en que se evalúan.
FAIL_NO_DATA = "no_data"
FAIL_MARKET_CAP = "market_cap"
FAIL_MONTHS_LISTED = "months_listed"
FAIL_REVENUE_GROWTH = "revenue_growth"
FAIL_FCF_MARGIN = "fcf_margin"
FAIL_GROSS_MARGIN = "gross_margin"
FAIL_NET_DEBT_EBITDA = "net_debt_ebitda"
FAIL_ROIC = "roic"
FAIL_SMA10M = "sma10m"
FAIL_MOMENTUM = "momentum_12_1"
FAIL_REL_STRENGTH = "rel_strength_6m"

FUNDAMENTAL_REASONS = frozenset(
    {FAIL_REVENUE_GROWTH, FAIL_FCF_MARGIN, FAIL_GROSS_MARGIN, FAIL_NET_DEBT_EBITDA, FAIL_ROIC}
)
TECHNICAL_REASONS = frozenset({FAIL_SMA10M, FAIL_MOMENTUM, FAIL_REL_STRENGTH})


@dataclass
class TickerData:
    """Datos crudos de un ticker tal como salen de yahoo.fetch_ticker()."""

    ticker: str
    name: Optional[str] = None
    exchange: Optional[str] = None
    currency: Optional[str] = None
    market_cap_usd: Optional[float] = None
    income: Statement = field(default_factory=dict)
    cashflow: Statement = field(default_factory=dict)
    balance: Statement = field(default_factory=dict)
    closes: dict[str, float] = field(default_factory=dict)  # "YYYY-MM" -> adj close
    error: Optional[str] = None


@dataclass
class ScreenResult:
    """Una fila de invest_screen_results (+ la señal de salida de §1.4)."""

    ticker: str
    name: Optional[str] = None
    exchange: Optional[str] = None
    market_cap: Optional[int] = None
    revenue_growth_yoy: Optional[float] = None
    fcf_margin: Optional[float] = None
    gross_margin: Optional[float] = None
    gross_margin_prev: Optional[float] = None
    net_debt_ebitda: Optional[float] = None
    roic: Optional[float] = None
    price: Optional[float] = None
    sma10m: Optional[float] = None
    momentum_12_1: Optional[float] = None
    rel_strength_6m: Optional[float] = None
    months_listed: Optional[int] = None
    passes_fundamental: bool = False
    passes_technical: bool = False
    passes: bool = False
    fail_reasons: list[str] = field(default_factory=list)
    # §1.4 salida mecánica: price < sma10m. None si falta price o sma10m.
    # No se guarda en invest_screen_results; alimenta invest_position_checks.
    sma_exit: Optional[bool] = None

    def to_db_row(self) -> dict[str, Any]:
        row = asdict(self)
        del row["sma_exit"]
        return row


def _bounded(value: Optional[float], limit: float) -> Optional[float]:
    if value is None:
        return None
    value = round(value, 4)
    return value if abs(value) < limit else None


def evaluate(row: TickerData, benchmark: MonthlySeries, run_date: date) -> ScreenResult:
    """Aplica §1.1–§1.4 al cierre mensual de `run_date`."""
    result = ScreenResult(ticker=row.ticker, name=row.name, exchange=row.exchange)
    t = ta.month_key(run_date)

    if row.error is not None or not row.closes:
        result.fail_reasons = [FAIL_NO_DATA]
        return result

    ticker = row.ticker
    reasons: list[str] = []

    # §1.1 universo
    result.market_cap = None if row.market_cap_usd is None else round(row.market_cap_usd)
    result.months_listed = ta.months_listed(row.closes, t)
    if result.market_cap is None or result.market_cap <= MIN_MARKET_CAP_USD:
        reasons.append(FAIL_MARKET_CAP)
    if result.months_listed < MIN_MONTHS_LISTED:
        reasons.append(FAIL_MONTHS_LISTED)

    # §1.2 fundamental
    result.revenue_growth_yoy = _bounded(fa.revenue_growth_yoy(row.income, ticker), RATIO_LIMIT)
    result.fcf_margin = _bounded(fa.fcf_margin(row.income, row.cashflow, ticker), RATIO_LIMIT)
    result.gross_margin = _bounded(fa.gross_margin(row.income, 0, ticker), RATIO_LIMIT)
    result.gross_margin_prev = _bounded(fa.gross_margin(row.income, 1, ticker), RATIO_LIMIT)
    result.net_debt_ebitda = _bounded(fa.net_debt_ebitda(row.income, row.balance, ticker), RATIO_LIMIT)
    result.roic = _bounded(fa.roic(row.income, row.balance, ticker), RATIO_LIMIT)
    net_debt = fa.net_debt(row.balance, ticker)

    if result.revenue_growth_yoy is None or not result.revenue_growth_yoy > MIN_REVENUE_GROWTH:
        reasons.append(FAIL_REVENUE_GROWTH)
    if result.fcf_margin is None or not result.fcf_margin > MIN_FCF_MARGIN:
        reasons.append(FAIL_FCF_MARGIN)
    # gross_margin >= gross_margin_prev - 0.01, comparando la diferencia
    # redondeada para que una caída de exactamente 1 punto no dependa del float.
    if (
        result.gross_margin is None
        or result.gross_margin_prev is None
        or not round(result.gross_margin - result.gross_margin_prev, 4) >= -MAX_GROSS_MARGIN_DROP
    ):
        reasons.append(FAIL_GROSS_MARGIN)
    net_cash = net_debt is not None and net_debt <= 0
    low_leverage = result.net_debt_ebitda is not None and result.net_debt_ebitda < MAX_NET_DEBT_EBITDA
    if not (net_cash or low_leverage):
        reasons.append(FAIL_NET_DEBT_EBITDA)
    if result.roic is None or not result.roic > MIN_ROIC:
        reasons.append(FAIL_ROIC)

    # §1.3 técnico
    result.price = _bounded(ta.close_at(row.closes, t), PRICE_LIMIT)
    result.sma10m = _bounded(ta.sma10m(row.closes, t), PRICE_LIMIT)
    result.momentum_12_1 = _bounded(ta.momentum_12_1(row.closes, t), RATIO_LIMIT)
    result.rel_strength_6m = _bounded(ta.rel_strength_6m(row.closes, benchmark, t), RATIO_LIMIT)

    if result.price is None or result.sma10m is None or not result.price > result.sma10m:
        reasons.append(FAIL_SMA10M)
    if result.momentum_12_1 is None or not result.momentum_12_1 > 0:
        reasons.append(FAIL_MOMENTUM)
    if result.rel_strength_6m is None or not result.rel_strength_6m > 0:
        reasons.append(FAIL_REL_STRENGTH)

    # §1.4 salida mecánica
    if result.price is not None and result.sma10m is not None:
        result.sma_exit = result.price < result.sma10m

    result.fail_reasons = reasons
    result.passes_fundamental = not FUNDAMENTAL_REASONS.intersection(reasons)
    result.passes_technical = not TECHNICAL_REASONS.intersection(reasons)
    result.passes = not reasons
    return result
