from __future__ import annotations

import copy
import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from screener.rules import TickerData

FIXTURES = Path(__file__).resolve().parent / "fixtures"
FIXTURE_RUN_DATE = date(2026, 9, 30)


def load_ticker(ticker: str) -> TickerData:
    payload: dict[str, Any] = json.loads((FIXTURES / f"{ticker}.json").read_text())
    payload.pop("run_date")
    return TickerData(**payload)


@pytest.fixture
def benchmark() -> dict[str, float]:
    return json.loads((FIXTURES / "benchmark_IWDA.AS.json").read_text())["closes"]


@pytest.fixture
def fixture_ticker():
    return lambda ticker: copy.deepcopy(load_ticker(ticker))
