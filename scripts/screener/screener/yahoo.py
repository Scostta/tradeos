"""Descarga de Yahoo Finance (yfinance) y normalización a TickerData."""

from __future__ import annotations

import logging
import math
import time
from datetime import date
from typing import Any, Callable, Optional, TypeVar

import pandas as pd
import requests
import yfinance as yf
from curl_cffi import CurlError
from yfinance.exceptions import YFRateLimitError

from . import technical as ta
from .rules import TickerData

log = logging.getLogger(__name__)

# Por defecto yfinance se traga las excepciones de income_stmt / cashflow /
# balance_sheet / info y devuelve un DataFrame vacío: un corte de red acabaría
# como fallo fundamental en vez de no_data. Con esto el error llega a
# with_retry() y, si persiste, a no_data. (Comprobado sobre 65 tickers reales:
# ningún caso legítimo cambia de resultado.)
yf.config.debug.hide_exceptions = False

ADJ_CLOSE = "Adj Close"
CLOSE = "Close"  # ajustado por splits, no por dividendos: el precio real de ese día

# §3.3: errores de red (DNS, conexión, timeout, 429) → un solo reintento a los 3 s.
NETWORK_ERRORS: tuple[type[BaseException], ...] = (
    CurlError,
    requests.exceptions.ConnectionError,
    requests.exceptions.Timeout,
    YFRateLimitError,
)
RETRY_DELAY_SECONDS = 3.0

T = TypeVar("T")


def with_retry(fn: Callable[[], T], label: str) -> T:
    """Ejecuta fn; ante un error de red espera 3 s y la reintenta una vez."""
    try:
        return fn()
    except NETWORK_ERRORS as exc:
        log.warning("%s: error de red (%s); reintento en %.0f s", label, exc, RETRY_DELAY_SECONDS)
        time.sleep(RETRY_DELAY_SECONDS)
        return fn()

# Divisa de cotización (info["currency"]) -> par de Yahoo para pasar el market
# cap a USD. Las cotizadas en Londres cotizan en "GBp" (peniques): su precio se
# pasa a libras con PRICE_UNIT y usan el par GBP. Una divisa que no está aquí
# deja market_cap en null (falla la regla).
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
PRICE_UNIT: dict[str, float] = {"GBp": 0.01}

# La app valora el satélite en EUR (INVEST_SPEC.md §5): el job guarda en
# invest_prices los cierres mensuales de estos pares (unidades de la divisa por
# 1 EUR). GBp usa EURGBP=X y la app divide además por 100 (PRICE_UNIT).
EUR_FX_TICKERS: dict[str, str] = {
    "USD": "EURUSD=X",
    "GBP": "EURGBP=X",
    "GBp": "EURGBP=X",
    "CHF": "EURCHF=X",
    "SEK": "EURSEK=X",
    "DKK": "EURDKK=X",
    "NOK": "EURNOK=X",
}


def monthly_closes(history: pd.DataFrame, through: str, column: str = ADJ_CLOSE) -> dict[str, float]:
    """{"YYYY-MM": cierre} hasta el mes `through` incluido (por defecto Adj Close).

    Yahoo etiqueta las barras mensuales por el inicio de mes en hora local y la
    del mes en curso es parcial: se descarta todo lo posterior a `through`.
    Si falta la columna se lanza error (no se usa otra en su lugar).
    """
    if column not in history.columns:
        raise KeyError(f"history sin columna {column!r}: {list(history.columns)}")
    closes: dict[str, float] = {}
    for ts, value in history[column].items():
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

    def download() -> pd.DataFrame:
        tk = yf.Ticker(ticker)
        if start is None:
            return tk.history(period="2y", interval="1mo", auto_adjust=False, raise_errors=True)
        return tk.history(
            start=start.isoformat(), interval="1mo", auto_adjust=False, raise_errors=True
        )

    return monthly_closes(with_retry(download, ticker), through)


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


def market_cap_usd(
    info: dict[str, Any], close: Optional[float], fx_rates: dict[str, float]
) -> Optional[float]:
    """Market cap en USD al cierre de run_date: Close(t) × acciones × FX(t).

    No se usa info.marketCap: va al precio del momento de ejecutar el job, no al
    de run_date (MU en el run de 2026-09-30: −15 %). Las acciones son
    impliedSharesOutstanding, que suma todas las clases; sharesOutstanding es
    solo la clase cotizada (GOOGL ×0,48, RO.SW ×0,13). Si falta algún dato → None.
    """
    shares, currency = info.get("impliedSharesOutstanding"), info.get("currency")
    if close is None or not shares or currency not in fx_rates:
        return None
    return close * PRICE_UNIT.get(currency, 1.0) * float(shares) * fx_rates[currency]


def fetch_ticker(ticker: str, through: str, fx_rates: dict[str, float]) -> TickerData:
    """Todo lo que evaluate() necesita de un ticker.

    Un error de red se reintenta una vez (with_retry). Si persiste, o es
    cualquier otro fallo de descarga, el ticker queda con error → no_data.
    """

    def download() -> tuple[pd.DataFrame, Any, Any, Any, dict[str, Any]]:
        tk = yf.Ticker(ticker)
        history = tk.history(period="2y", interval="1mo", auto_adjust=False, raise_errors=True)
        return history, tk.income_stmt, tk.cashflow, tk.balance_sheet, tk.info or {}

    try:
        history, income_df, cashflow_df, balance_df, info = with_retry(download, ticker)
        if history.empty:
            return TickerData(ticker=ticker, error="empty history")
        closes = monthly_closes(history, through)
        close_t = monthly_closes(history, through, CLOSE).get(through)
        income = statement_to_dict(income_df)
        cashflow = statement_to_dict(cashflow_df)
        balance = statement_to_dict(balance_df)
    except Exception as exc:  # noqa: BLE001 — §3.3: se registra como no_data
        log.warning("%s: %s", ticker, exc)
        return TickerData(ticker=ticker, error=f"{type(exc).__name__}: {exc}")
    return TickerData(
        ticker=ticker,
        name=info.get("longName") or info.get("shortName"),
        exchange=info.get("exchange"),
        currency=info.get("currency"),
        sector=info.get("sector"),
        market_cap_usd=market_cap_usd(info, close_t, fx_rates),
        income=income,
        cashflow=cashflow,
        balance=balance,
        closes=closes,
    )
