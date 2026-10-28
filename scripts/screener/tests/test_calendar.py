from __future__ import annotations

from datetime import date

import pytest

from screener.market_calendar import (
    NYSE_HOLIDAYS,
    first_business_day,
    is_business_day,
    last_business_day,
    previous_month_run_date,
)


@pytest.mark.parametrize(
    "year, month, expected",
    [
        (2026, 9, date(2026, 9, 1)),    # martes normal
        (2026, 8, date(2026, 8, 3)),    # 1 = sábado → lunes 3
        (2026, 11, date(2026, 11, 2)),  # 1 = domingo → lunes 2
        (2027, 1, date(2027, 1, 4)),    # 1 = viernes festivo, luego fin de semana
        (2028, 1, date(2028, 1, 3)),    # 1 = sábado, NYSE no traslada el festivo
        (2029, 9, date(2029, 9, 4)),    # 1 = sábado, lunes 3 = Labor Day → martes 4
    ],
)
def test_first_business_day(year, month, expected):
    assert first_business_day(year, month) == expected


@pytest.mark.parametrize(
    "year, month, expected",
    [
        (2026, 9, date(2026, 9, 30)),   # miércoles normal
        (2026, 5, date(2026, 5, 29)),   # 31 = domingo → viernes 29
        (2029, 3, date(2029, 3, 29)),   # 30 = Viernes Santo → jueves 29
        (2027, 12, date(2027, 12, 31)), # Navidad se observa el 24, el 31 es hábil
    ],
)
def test_last_business_day(year, month, expected):
    assert last_business_day(year, month) == expected


@pytest.mark.parametrize(
    "today, expected",
    [
        (date(2026, 10, 1), date(2026, 9, 30)),
        (date(2026, 10, 27), date(2026, 9, 30)),
        (date(2027, 1, 4), date(2026, 12, 31)),
        (date(2026, 6, 1), date(2026, 5, 29)),
    ],
)
def test_previous_month_run_date(today, expected):
    assert previous_month_run_date(today) == expected


def test_weekend_and_holiday_are_not_business_days():
    assert not is_business_day(date(2026, 10, 31))  # sábado
    assert not is_business_day(date(2026, 11, 26))  # Thanksgiving
    assert is_business_day(date(2026, 11, 27))


def test_holidays_are_all_weekdays():
    assert all(d.weekday() < 5 for d in NYSE_HOLIDAYS)


def test_year_outside_the_list_raises():
    with pytest.raises(ValueError, match="NYSE_HOLIDAYS"):
        first_business_day(2031, 1)


def test_holidays_match_exchange_calendars():
    """La lista fija coincide con el calendario XNYS (dependencia solo de tests)."""
    import exchange_calendars as xc
    import pandas as pd

    nyse = xc.get_calendar("XNYS", start="2022-12-01", end="2030-12-31")
    weekdays = pd.bdate_range("2023-01-01", "2030-12-31")
    closed = {d.date() for d in weekdays if not nyse.is_session(d)}
    assert closed == set(NYSE_HOLIDAYS)
