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
            return pd.DataFrame({"Close": [10.2, 11.1], "Adj Close": [10.0, 11.0]}, index=index)

        income_stmt = pd.DataFrame({pd.Timestamp("2025-12-31"): [100.0]}, index=["Total Revenue"])
        cashflow = pd.DataFrame()
        balance_sheet = pd.DataFrame()
        info = {
            "marketCap": 5e9,
            "impliedSharesOutstanding": 500_000_000,
            "sharesOutstanding": 300_000_000,
            "currency": "USD",
            "longName": "Fake Inc",
            "exchange": "NMS",
            "sector": "Technology",
        }

    monkeypatch.setattr(yahoo.yf, "Ticker", FakeTicker)
    return created


def test_fetch_ticker_recovers_after_one_network_error(monkeypatch, sleeps):
    created = fake_ticker_factory(monkeypatch, [DNS_ERROR])
    data = yahoo.fetch_ticker("FAKE", "2026-09", {"USD": 1.0})
    assert data.error is None
    assert data.closes == {"2026-08": 10.0, "2026-09": 11.0}
    assert data.sector == "Technology"
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


def test_fetch_ticker_market_cap_uses_unadjusted_close_at_run_date(monkeypatch, sleeps):
    """Close (no Adj Close) de t × impliedSharesOutstanding; info.marketCap se ignora."""
    fake_ticker_factory(monkeypatch, [])
    data = yahoo.fetch_ticker("FAKE", "2026-09", {"USD": 1.0})
    assert data.market_cap_usd == pytest.approx(11.1 * 500_000_000)


# ── market_cap_usd ───────────────────────────────────────────────────────────

MU_INFO = {
    # info de MU leído el 2026-10-27: marketCap al precio de ese día (914,65)
    "marketCap": 1_034_856_300_544,
    "sharesOutstanding": 1_131_423_212,
    "impliedSharesOutstanding": 1_131_423_212,
    "currency": "USD",
}


def test_market_cap_is_priced_at_run_date_not_at_execution():
    # Close de MU al 2026-09-30: 1065,11 → 1,205e12, no el 1,035e12 de info.
    cap = yahoo.market_cap_usd(MU_INFO, 1065.11, {"USD": 1.0})
    assert cap == pytest.approx(1065.11 * 1_131_423_212)
    assert round(cap / 1e9) == 1205


def test_market_cap_counts_every_share_class():
    # GOOGL: sharesOutstanding es solo la clase A (5,87e9); implied suma A+B+C.
    info = {"sharesOutstanding": 5_867_155_790, "impliedSharesOutstanding": 12_229_934_831, "currency": "USD"}
    assert yahoo.market_cap_usd(info, 300.0, {"USD": 1.0}) == pytest.approx(300.0 * 12_229_934_831)


def test_market_cap_converts_pence_and_fx():
    info = {"impliedSharesOutstanding": 1_000_000_000, "currency": "GBp"}
    rates = {"GBp": 1.25}
    # 12 800 peniques = 128 £ × 1e9 acciones × 1,25 USD/£
    assert yahoo.market_cap_usd(info, 12_800.0, rates) == pytest.approx(128 * 1e9 * 1.25)
    eur = {"impliedSharesOutstanding": 1_000_000_000, "currency": "EUR"}
    assert yahoo.market_cap_usd(eur, 100.0, {"EUR": 1.1}) == pytest.approx(1.1e11)


@pytest.mark.parametrize(
    "info, close, rates",
    [
        ({"sharesOutstanding": 1e9, "currency": "USD", "marketCap": 5e10}, 50.0, {"USD": 1.0}),
        ({"impliedSharesOutstanding": 1e9, "currency": "USD"}, None, {"USD": 1.0}),
        ({"impliedSharesOutstanding": 1e9, "currency": "ZAc"}, 50.0, {"USD": 1.0}),
        ({"impliedSharesOutstanding": 1e9, "currency": "EUR"}, 50.0, {"USD": 1.0}),
    ],
    ids=["sin implied", "sin close", "divisa desconocida", "sin FX"],
)
def test_market_cap_missing_input_is_null(info, close, rates):
    assert yahoo.market_cap_usd(info, close, rates) is None
