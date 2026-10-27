"""Series mensuales y cálculos técnicos de §1.3.

Las series son dict "YYYY-MM" -> cierre mensual ajustado. Se indexan por mes
(no por posición) para que un mes que falte dé null en vez de desplazar la
ventana.
"""

from __future__ import annotations

from datetime import date
from typing import Mapping, Optional

MonthlySeries = Mapping[str, float]


def month_key(d: date) -> str:
    return f"{d.year:04d}-{d.month:02d}"


def shift_month(key: str, months: int) -> str:
    year, month = int(key[:4]), int(key[5:7])
    idx = year * 12 + (month - 1) + months
    return f"{idx // 12:04d}-{idx % 12 + 1:02d}"


def close_at(closes: MonthlySeries, key: str, offset: int = 0) -> Optional[float]:
    return closes.get(shift_month(key, offset))


def sma10m(closes: MonthlySeries, t: str) -> Optional[float]:
    """Media simple de los 10 últimos cierres mensuales, incluido t."""
    window = [close_at(closes, t, -i) for i in range(10)]
    if any(v is None for v in window):
        return None
    return sum(v for v in window if v is not None) / 10


def momentum_12_1(closes: MonthlySeries, t: str) -> Optional[float]:
    """P[t-1] / P[t-12] - 1."""
    p1, p12 = close_at(closes, t, -1), close_at(closes, t, -12)
    if p1 is None or p12 is None or p12 <= 0:
        return None
    return p1 / p12 - 1


def rel_strength_6m(
    closes: MonthlySeries, benchmark: MonthlySeries, t: str
) -> Optional[float]:
    """(P[t]/P[t-6]) - (B[t]/B[t-6])."""
    p0, p6 = close_at(closes, t), close_at(closes, t, -6)
    b0, b6 = close_at(benchmark, t), close_at(benchmark, t, -6)
    if p0 is None or p6 is None or b0 is None or b6 is None or p6 <= 0 or b6 <= 0:
        return None
    return p0 / p6 - b0 / b6


def months_listed(closes: MonthlySeries, t: str) -> int:
    """Cierres mensuales disponibles hasta t (acotado por la ventana descargada)."""
    return sum(1 for k in closes if k <= t)
