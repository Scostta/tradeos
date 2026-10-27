from __future__ import annotations

import math

import pandas as pd
import pytest

from screener.technical import (
    momentum_12_1,
    months_listed,
    rel_strength_6m,
    shift_month,
    sma10m,
)
from screener.yahoo import monthly_closes, statement_to_dict

T = "2026-09"

# 13 cierres, de t-12 (2025-09) a t (2026-09): 100, 102, ..., 124.
CLOSES = {shift_month(T, i - 12): 100.0 + 2 * i for i in range(13)}
# Benchmark: 100 en t-6, 110 en t.
BENCH = {shift_month(T, -6): 100.0, T: 110.0}


def test_shift_month_crosses_years():
    assert shift_month("2026-01", -1) == "2025-12"
    assert shift_month("2025-12", 1) == "2026-01"
    assert shift_month(T, -12) == "2025-09"
    assert shift_month(T, -21) == "2024-12"


def test_sma10m_by_hand():
    # Últimos 10 cierres (incluido t): 106, 108, ..., 124 → media 115.
    assert sma10m(CLOSES, T) == pytest.approx(115.0)


def test_momentum_12_1_by_hand():
    # P[t-1] = 122, P[t-12] = 100 → 0,22 (el mes actual no cuenta).
    assert momentum_12_1(CLOSES, T) == pytest.approx(0.22)


def test_rel_strength_6m_by_hand():
    # P[t]/P[t-6] = 124/112 ; B[t]/B[t-6] = 110/100.
    assert rel_strength_6m(CLOSES, BENCH, T) == pytest.approx(124 / 112 - 1.1)
    assert rel_strength_6m(CLOSES, BENCH, T) == pytest.approx(0.0071429, abs=1e-7)


def test_months_listed_ignores_later_months():
    assert months_listed({**CLOSES, "2026-10": 130.0}, T) == 13


def test_window_with_a_gap_is_null():
    gapped = dict(CLOSES)
    del gapped[shift_month(T, -5)]
    assert sma10m(gapped, T) is None
    assert momentum_12_1(dict(list(CLOSES.items())[1:]), T) is None  # sin P[t-12]
    assert rel_strength_6m(CLOSES, {T: 110.0}, T) is None


def test_monthly_closes_drops_partial_month_and_nan():
    index = pd.DatetimeIndex(
        ["2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01"], tz="America/New_York"
    )
    history = pd.DataFrame(
        {"Close": [11.0, 21.0, 31.0, 41.0], "Adj Close": [10.0, math.nan, 30.0, 40.0]},
        index=index,
    )
    assert monthly_closes(history, T) == {"2026-07": 10.0, "2026-09": 30.0}


def test_monthly_closes_without_adj_close_raises():
    history = pd.DataFrame({"Close": [1.0]}, index=pd.DatetimeIndex(["2026-09-01"]))
    with pytest.raises(KeyError, match="Adj Close"):
        monthly_closes(history, T)


def test_statement_to_dict_newest_first_and_nan_to_none():
    df = pd.DataFrame(
        {pd.Timestamp("2024-12-31"): [100.0, math.nan], pd.Timestamp("2025-12-31"): [120.0, 60.0]},
        index=["Total Revenue", "Gross Profit"],
    )
    assert statement_to_dict(df) == {"Total Revenue": [120.0, 100.0], "Gross Profit": [60.0, None]}
    assert statement_to_dict(pd.DataFrame()) == {}
