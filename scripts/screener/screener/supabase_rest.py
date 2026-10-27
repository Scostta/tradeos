"""Cliente mínimo de PostgREST (Supabase) con la service role.

Cada petición abre su propia conexión (sin requests.Session ni keep-alive).
Entre las lecturas del inicio y las escrituras pasan 15–30 min de descargas de
Yahoo; en los runners de GitHub el NAT descarta en silencio las conexiones TCP
inactivas y una conexión reutilizada se quedaba colgada hasta el ReadTimeout.
"""

from __future__ import annotations

from typing import Any, Iterable, Optional

import requests

Row = dict[str, Any]


class SupabaseError(RuntimeError):
    pass


class SupabaseRest:
    def __init__(self, url: str, service_role_key: str, timeout: int = 60) -> None:
        self.base = url.rstrip("/") + "/rest/v1"
        self.timeout = timeout
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
            "Connection": "close",
        }

    def _request(
        self,
        method: str,
        table: str,
        params: Optional[dict[str, str]] = None,
        json: Any = None,
        prefer: Optional[str] = None,
    ) -> Any:
        headers = {**self.headers, **({"Prefer": prefer} if prefer else {})}
        response = requests.request(
            method,
            f"{self.base}/{table}",
            params=params,
            json=json,
            headers=headers,
            timeout=self.timeout,
        )
        if response.status_code >= 400:
            raise SupabaseError(f"{method} {table} -> {response.status_code}: {response.text}")
        return response.json() if response.content else None

    def select(self, table: str, params: dict[str, str]) -> list[Row]:
        return self._request("GET", table, params=params) or []

    def insert(
        self,
        table: str,
        rows: list[Row],
        returning: bool = False,
        on_conflict: Optional[str] = None,
    ) -> list[Row]:
        prefer = ["return=representation" if returning else "return=minimal"]
        params = None
        if on_conflict:
            prefer.append("resolution=merge-duplicates")
            params = {"on_conflict": on_conflict}
        return self._request("POST", table, params=params, json=rows, prefer=",".join(prefer)) or []

    def insert_chunked(self, table: str, rows: list[Row], size: int = 500, **kwargs: Any) -> None:
        for chunk in _chunks(rows, size):
            self.insert(table, chunk, **kwargs)

    def update(self, table: str, filters: dict[str, str], values: Row) -> list[Row]:
        return self._request(
            "PATCH", table, params=filters, json=values, prefer="return=representation"
        ) or []

    def delete(self, table: str, filters: dict[str, str]) -> None:
        self._request("DELETE", table, params=filters, prefer="return=minimal")


def _chunks(rows: list[Row], size: int) -> Iterable[list[Row]]:
    for i in range(0, len(rows), size):
        yield rows[i : i + size]
