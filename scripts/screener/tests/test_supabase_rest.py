from __future__ import annotations

import json as jsonlib
from typing import Any

import pytest

from screener import supabase_rest
from screener.supabase_rest import SupabaseError, SupabaseRest


class FakeResponse:
    def __init__(self, status: int = 200, body: Any = None) -> None:
        self.status_code = status
        self.content = b"" if body is None else jsonlib.dumps(body).encode()
        self.text = self.content.decode()

    def json(self) -> Any:
        return jsonlib.loads(self.content)


@pytest.fixture
def calls(monkeypatch):
    recorded: list[dict[str, Any]] = []
    responses: list[FakeResponse] = []

    def fake_request(method, url, **kwargs):
        recorded.append({"method": method, "url": url, **kwargs})
        return responses.pop(0) if responses else FakeResponse()

    monkeypatch.setattr(supabase_rest.requests, "request", fake_request)
    return recorded, responses


def client() -> SupabaseRest:
    return SupabaseRest("https://xyz.supabase.co/", "service-key")


def test_every_request_opens_its_own_connection(calls):
    """Sin keep-alive: tras 15–30 min de Yahoo, una conexión reutilizada se colgaba
    hasta el ReadTimeout en los runners de GitHub."""
    recorded, _ = calls
    c = client()
    c.select("invest_settings", {"select": "benchmark_ticker"})
    c.delete("invest_screen_results", {"run_id": "eq.r1"})
    assert not hasattr(c, "session")
    assert len(recorded) == 2
    for call in recorded:
        assert call["headers"]["Connection"] == "close"
        assert call["headers"]["apikey"] == "service-key"
        assert call["headers"]["Authorization"] == "Bearer service-key"
        assert call["timeout"] == 60


def test_select_builds_postgrest_url_and_returns_rows(calls):
    recorded, responses = calls
    responses.append(FakeResponse(body=[{"id": "r1"}]))
    rows = client().select("invest_screen_runs", {"select": "id", "run_date": "eq.2026-09-30"})
    assert rows == [{"id": "r1"}]
    assert recorded[0]["method"] == "GET"
    assert recorded[0]["url"] == "https://xyz.supabase.co/rest/v1/invest_screen_runs"
    assert recorded[0]["params"] == {"select": "id", "run_date": "eq.2026-09-30"}


def test_upsert_sets_on_conflict_and_merge_header(calls):
    recorded, _ = calls
    client().insert("invest_prices", [{"ticker": "X"}], on_conflict="ticker,month_end")
    assert recorded[0]["params"] == {"on_conflict": "ticker,month_end"}
    assert recorded[0]["headers"]["Prefer"] == "return=minimal,resolution=merge-duplicates"


def test_insert_chunked_splits_rows(calls):
    recorded, _ = calls
    client().insert_chunked("invest_screen_results", [{"i": i} for i in range(1200)], size=500)
    assert [len(c["json"]) for c in recorded] == [500, 500, 200]


def test_http_error_raises_with_body(calls):
    _, responses = calls
    responses.append(FakeResponse(status=401, body={"message": "Invalid API key"}))
    with pytest.raises(SupabaseError, match="401.*Invalid API key"):
        client().select("invest_settings", {"select": "*"})
