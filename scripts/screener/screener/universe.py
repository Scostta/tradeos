"""Universo del screener (§1.1): S&P 500 de Wikipedia + universe_extra.csv."""

from __future__ import annotations

import csv
from io import StringIO
from pathlib import Path

import pandas as pd
import requests

SP500_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
EXTRA_CSV = Path(__file__).resolve().parent.parent / "universe_extra.csv"
USER_AGENT = "TradeOS-screener/1.0 (https://github.com; monthly job)"


def sp500_tickers() -> list[str]:
    """Constituyentes actuales en formato Yahoo (BRK.B -> BRK-B)."""
    response = requests.get(SP500_URL, headers={"User-Agent": USER_AGENT}, timeout=30)
    response.raise_for_status()
    table = pd.read_html(StringIO(response.text), attrs={"id": "constituents"})[0]
    tickers = [str(s).strip().replace(".", "-") for s in table["Symbol"]]
    if len(tickers) < 490:
        raise RuntimeError(f"S&P 500 de Wikipedia con solo {len(tickers)} filas; ¿cambió la tabla?")
    return tickers


def extra_tickers(path: Path = EXTRA_CSV) -> list[str]:
    with path.open(encoding="utf-8") as f:
        rows = csv.DictReader(line for line in f if not line.startswith("#"))
        return [row["ticker"].strip() for row in rows if row["ticker"].strip()]


def build_universe(sp500: list[str], extra: list[str]) -> list[str]:
    seen: set[str] = set()
    universe: list[str] = []
    for ticker in [*sp500, *extra]:
        if ticker not in seen:
            seen.add(ticker)
            universe.append(ticker)
    return universe
