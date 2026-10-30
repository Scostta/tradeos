from datetime import date

import requests

from screener.notify import notify_run


class Res:
    def __init__(self, status: int, text: str = "{}") -> None:
        self.status_code = status
        self.text = text


def test_sin_variables_no_avisa(monkeypatch):
    monkeypatch.delenv("INVEST_NOTIFY_URL", raising=False)
    monkeypatch.delenv("INVEST_NOTIFY_SECRET", raising=False)
    calls = []
    assert notify_run(date(2026, 10, 30), post=lambda *a, **k: calls.append(1)) is False
    assert calls == []


def test_manda_el_run_con_el_secreto(monkeypatch):
    monkeypatch.setenv("INVEST_NOTIFY_URL", "https://app.test/api/invest/notify")
    monkeypatch.setenv("INVEST_NOTIFY_SECRET", "s3cret")
    seen = {}

    def post(url, json, headers, timeout):
        seen.update(url=url, json=json, headers=headers)
        return Res(200)

    assert notify_run(date(2026, 10, 30), post=post) is True
    assert seen["json"] == {"event": "run", "runDate": "2026-10-30"}
    assert seen["headers"] == {"Authorization": "Bearer s3cret"}


def test_un_fallo_no_lanza(monkeypatch):
    monkeypatch.setenv("INVEST_NOTIFY_URL", "https://app.test/api/invest/notify")
    monkeypatch.setenv("INVEST_NOTIFY_SECRET", "s3cret")

    def boom(*a, **k):
        raise requests.ConnectionError("down")

    assert notify_run(date(2026, 10, 30), post=boom) is False
    assert notify_run(date(2026, 10, 30), post=lambda *a, **k: Res(503, "PUSH_NOT_CONFIGURED")) is False
