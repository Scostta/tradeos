"""Descarga de Yahoo Finance (yfinance) y normalización a TickerData."""

from __future__ import annotations

import logging
import math
from datetime import date
from typing import Any, Optional

import pandas as pd
import yfinance as yf

from . import technical as ta
from .rules import TickerData

log = logging.getLogger(__name__)

ADJ_CLOSE = "Adj Close"

# Divisa de info["currency"] -> par de Yahoo para pasar marketCap a USD.
# Las cotizadas en Londres declaran "GBp" (peniques) pero Yahoo da su marketCap
# en libras (comprobado: marketCap = acciones × precio / 100), así que usan GBP.
# Una divisa que no está aquí deja market_cap en null (falla la regla).
FX_TICKERS: dict[str, Optional[str]] = {
    "USD": None,
    "EUR": "EURUSD=X",
    "GBP": "GBPUSD=X",
    "GBp": "GBPUSD=X",
    "CHF": "CHFUSD=X",
    "SEK": "SEKUSD=X",
    "DKK": "DKKUSD=X",
    "NOK": "NOKUSD=X",
}


def monthly_closes(history: pd.DataFrame, through: str) -> dict[str, float]:
    """{"YYYY-MM": Adj Close} hasta el mes `through` incluido.

    Yahoo etiqueta las barras mensuales por el inicio de mes en hora local y la
    del mes en curso es parcial: se descarta todo lo posterior a `through`.
    Si falta la columna Adj Close se lanza error (no se usa Close en su lugar).
    """
    if ADJ_CLOSE not in history.columns:
        raise KeyError(f"history sin columna {ADJ_CLOSE!r}: {list(history.columns)}")
    closes: dict[str, float] = {}
    for ts, value in history[ADJ_CLOSE].items():
        if value is None or math.isnan(value):
            continue
        key = ta.month_key(ts.date())
        if key <= through:
            closes[key] = float(value)  # si hay dos filas del mismo mes, gana la última
    return closes


def statement_to_dict(df: Optional[pd.DataFrame]) -> dict[str, list[Optional[float]]]:
    """DataFrame de yfinance (filas = campos, columnas = años) -> {campo: [más reciente, ...]}."""
    if df is None or df.empty:
        return {}
    df = df[sorted(df.columns, reverse=True)]
    return {
        str(name): [None if pd.isna(v) else float(v) for v in values]
        for name, values in df.iterrows()
    }


def fetch_monthly(ticker: str, through: str, start: Optional[date] = None) -> dict[str, float]:
    """Cierres mensuales ajustados. Sin `start`: period="2y" (§3.2)."""
    tk = yf.Ticker(ticker)
    if start is None:
        history = tk.history(period="2y", interval="1mo", auto_adjust=False, raise_errors=True)
    else:
        history = tk.history(
            start=start.isoformat(), interval="1mo", auto_adjust=False, raise_errors=True
        )
    return monthly_closes(history, through)


def load_fx_rates(through: str) -> dict[str, float]:
    """Tipo divisa->USD al cierre del mes `through`, por cada divisa de FX_TICKERS."""
    rates: dict[str, float] = {}
    for currency, pair in FX_TICKERS.items():
        if pair is None:
            rates[currency] = 1.0
            continue
        try:
            rate = fetch_monthly(pair, through).get(through)
        except Exception as exc:  # noqa: BLE001 — se registra y la divisa queda sin tipo
            log.warning("FX %s: %s", pair, exc)
            continue
        if rate is None:
            log.warning("FX %s: sin cierre para %s", pair, through)
            continue
        rates[currency] = rate
    return rates


def market_cap_usd(info: dict[str, Any], fx_rates: dict[str, float]) -> Optional[float]:
    market_cap, currency = info.get("marketCap"), info.get("currency")
    if market_cap is None or currency not in fx_rates:
        return None
    return float(market_cap) * fx_rates[currency]


def fetch_ticker(ticker: str, through: str, fx_rates: dict[str, float]) -> TickerData:
    """Todo lo que evaluate() necesita de un ticker. Cualquier fallo de descarga -> error."""
    tk = yf.Ticker(ticker)
    try:
        history = tk.history(period="2y", interval="1mo", auto_adjust=False, raise_errors=True)
        if history.empty:
            return TickerData(ticker=ticker, error="empty history")
        closes = monthly_closes(history, through)
        income = statement_to_dict(tk.income_stmt)
        cashflow = statement_to_dict(tk.cashflow)
        balance = statement_to_dict(tk.balance_sheet)
        info = tk.info or {}
    except Exception as exc:  # noqa: BLE001 — §3.3: se registra como no_data
        log.warning("%s: %s", ticker, exc)
        return TickerData(ticker=ticker, error=f"{type(exc).__name__}: {exc}")
    return TickerData(
        ticker=ticker,
        name=info.get("longName") or info.get("shortName"),
        exchange=info.get("exchange"),
        currency=info.get("currency"),
        market_cap_usd=market_cap_usd(info, fx_rates),
        income=income,
        cashflow=cashflow,
        balance=balance,
        closes=closes,
    )
