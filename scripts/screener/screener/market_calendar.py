"""Días hábiles NYSE con una lista fija de festivos (INVEST_SPEC.md §3.1).

La lista cubre 2024–2030 (ventana de precios de 2 años + forward test de 36
meses). Un año fuera de la lista lanza error en vez de tratar todos sus días
como hábiles: hay que ampliar NYSE_HOLIDAYS.
"""

from __future__ import annotations

import calendar
from datetime import date, timedelta

# Cierres completos de NYSE (sin medias sesiones). Verificada contra
# exchange_calendars (XNYS). 2028-01-01 cae en sábado y NYSE no lo traslada.
NYSE_HOLIDAYS: frozenset[date] = frozenset(
    date.fromisoformat(d)
    for d in """
    2024-01-01 2024-01-15 2024-02-19 2024-03-29 2024-05-27 2024-06-19
    2024-07-04 2024-09-02 2024-11-28 2024-12-25
    2025-01-01 2025-01-09 2025-01-20 2025-02-17 2025-04-18 2025-05-26
    2025-06-19 2025-07-04 2025-09-01 2025-11-27 2025-12-25
    2026-01-01 2026-01-19 2026-02-16 2026-04-03 2026-05-25 2026-06-19
    2026-07-03 2026-09-07 2026-11-26 2026-12-25
    2027-01-01 2027-01-18 2027-02-15 2027-03-26 2027-05-31 2027-06-18
    2027-07-05 2027-09-06 2027-11-25 2027-12-24
    2028-01-17 2028-02-21 2028-04-14 2028-05-29 2028-06-19 2028-07-04
    2028-09-04 2028-11-23 2028-12-25
    2029-01-01 2029-01-15 2029-02-19 2029-03-30 2029-05-28 2029-06-19
    2029-07-04 2029-09-03 2029-11-22 2029-12-25
    2030-01-01 2030-01-21 2030-02-18 2030-04-19 2030-05-27 2030-06-19
    2030-07-04 2030-09-02 2030-11-28 2030-12-25
    """.split()
)
COVERED_YEARS = range(2024, 2031)


def is_business_day(d: date) -> bool:
    if d.year not in COVERED_YEARS:
        raise ValueError(f"{d.year} no está en NYSE_HOLIDAYS; amplía la lista")
    return d.weekday() < 5 and d not in NYSE_HOLIDAYS


def first_business_day(year: int, month: int) -> date:
    d = date(year, month, 1)
    while not is_business_day(d):
        d += timedelta(days=1)
    return d


def last_business_day(year: int, month: int) -> date:
    d = date(year, month, calendar.monthrange(year, month)[1])
    while not is_business_day(d):
        d -= timedelta(days=1)
    return d


def previous_month_run_date(today: date) -> date:
    """run_date por defecto: último día hábil del mes anterior a `today`."""
    prev = today.replace(day=1) - timedelta(days=1)
    return last_business_day(prev.year, prev.month)
