from __future__ import annotations

import pandas as pd
import pytest
import yfinance as yf
from curl_cffi import CurlError
from yfinance.exceptions import YFPricesMissingError, YFRateLimitError

from screener import yahoo
from screener.rules import evaluate

from .conftest import FIXTURE_RUN_DATE

DNS_ERROR = CurlError("curl: (6) Could not resolve host: query2.finance.yahoo.com", 6)


@pytest.fixture
def sleeps(monkeypatch):
    calls: list[float] = []
    monkeypatch.setattr(yahoo.time, "sleep", calls.append)
    return calls


class Flaky:
    """Callable que lanza los errores de `errors` en orden y luego devuelve 'ok'."""

    def __init__(self, *errors: BaseException) -> None:
        self.errors = list(errors)
        self.calls = 0

    def __call__(self) -> str:
        self.calls += 1
        if self.errors:
            raise self.errors.pop(0)
        return "ok"


def test_yfinance_exceptions_are_not_hidden():
    assert yf.config.debug.hide_exceptions is False


def test_network_error_is_retried_once_after_3s(sleeps):
    fn = Flaky(DNS_ERROR)
    assert yahoo.with_retry(fn, "MSFT") == "ok"
    assert fn.calls == 2
    assert sleeps == [3.0]


def test_rate_limit_counts_as_network_error(sleeps):
    fn = Flaky(YFRateLimitError())
    assert yahoo.with_retry(fn, "MSFT") == "ok"
    assert sleeps == [3.0]


def test_second_network_error_is_not_retried_again(sleeps):
    fn = Flaky(DNS_ERROR, DNS_ERROR, DNS_ERROR)
    with pytest.raises(CurlError):
        yahoo.with_retry(fn, "MSFT")
    assert fn.calls == 2
    assert sleeps == [3.0]


@pytest.mark.parametrize("error", [YFPricesMissingError("XX", ""), KeyError("Adj Close")])
def test_non_network_error_is_not_retried(sleeps, error):
    fn = Flaky(error)
    with pytest.raises(type(error)):
        yahoo.with_retry(fn, "XX")
    assert fn.calls == 1
    assert sleeps == []


# ── fetch_ticker con un yf.Ticker falso ──────────────────────────────────────


def fake_ticker_factory(monkeypatch, failures: list[BaseException]):
    """Cada yf.Ticker() nuevo consume un error de `failures` en history()."""
    created: list[str] = []

    class FakeTicker:
        def __init__(self, symbol: str) -> None:
            created.append(symbol)
            self.error = failures.pop(0) if failures else None

        def history(self, **kwargs):
            if self.error is not None:
                raise self.error
            index = pd.DatetimeIndex(["2026-08-01", "2026-09-01"], tz="America/New_York")
            return pd.DataFrame({"Adj Close": [10.0, 11.0]}, index=index)

        income_stmt = pd.DataFrame({pd.Timestamp("2025-12-31"): [100.0]}, index=["Total Revenue"])
        cashflow = pd.DataFrame()
        balance_sheet = pd.DataFrame()
        info = {"marketCap": 5e9, "currency": "USD", "longName": "Fake Inc", "exchange": "NMS"}

    monkeypatch.setattr(yahoo.yf, "Ticker", FakeTicker)
    return created


def test_fetch_ticker_recovers_after_one_network_error(monkeypatch, sleeps):
    created = fake_ticker_factory(monkeypatch, [DNS_ERROR])
    data = yahoo.fetch_ticker("FAKE", "2026-09", {"USD": 1.0})
    assert data.error is None
    assert data.closes == {"2026-08": 10.0, "2026-09": 11.0}
    assert data.market_cap_usd == 5e9
    assert created == ["FAKE", "FAKE"] and sleeps == [3.0]


def test_fetch_ticker_two_network_errors_is_no_data(monkeypatch, sleeps):
    created = fake_ticker_factory(monkeypatch, [DNS_ERROR, DNS_ERROR])
    data = yahoo.fetch_ticker("FAKE", "2026-09", {"USD": 1.0})
    assert data.error is not None and "CurlError" in data.error
    assert len(created) == 2 and sleeps == [3.0]
    assert evaluate(data, {}, FIXTURE_RUN_DATE).fail_reasons == ["no_data"]


def test_fetch_ticker_missing_prices_is_no_data_without_retry(monkeypatch, sleeps):
    created = fake_ticker_factory(monkeypatch, [YFPricesMissingError("FAKE", "")])
    data = yahoo.fetch_ticker("FAKE", "2026-09", {"USD": 1.0})
    assert data.error is not None and "YFPricesMissingError" in data.error
    assert len(created) == 1 and sleeps == []


def test_fetch_monthly_retries_too(monkeypatch, sleeps):
    fake_ticker_factory(monkeypatch, [DNS_ERROR])
    assert yahoo.fetch_monthly("IWDA.AS", "2026-09") == {"2026-08": 10.0, "2026-09": 11.0}
    assert sleeps == [3.0]
