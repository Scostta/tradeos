"""Aviso a la app al terminar un run (INVEST_SPEC §4.10).

POST {INVEST_NOTIFY_URL} con Bearer INVEST_NOTIFY_SECRET; la app manda los
avisos push (run nuevo y señales de venta). Sin las dos variables no hace nada.
Un fallo al avisar nunca tumba el job: el run ya está escrito.
"""

from __future__ import annotations

import logging
import os
from datetime import date

import requests

log = logging.getLogger(__name__)

TIMEOUT_S = 30


def notify_run(run_date: date, post=requests.post) -> bool:
    url, secret = os.environ.get("INVEST_NOTIFY_URL"), os.environ.get("INVEST_NOTIFY_SECRET")
    if not url or not secret:
        log.info("INVEST_NOTIFY_URL / INVEST_NOTIFY_SECRET sin definir: sin avisos")
        return False
    try:
        res = post(
            url,
            json={"event": "run", "runDate": run_date.isoformat()},
            headers={"Authorization": f"Bearer {secret}"},
            timeout=TIMEOUT_S,
        )
        if res.status_code >= 400:
            log.warning("aviso del run: HTTP %s %s", res.status_code, res.text[:200])
            return False
        log.info("aviso del run enviado: %s", res.text[:200])
        return True
    except requests.RequestException as exc:
        log.warning("aviso del run: %s", exc)
        return False
