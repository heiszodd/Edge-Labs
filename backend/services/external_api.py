from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import httpx

log = logging.getLogger(__name__)


@dataclass
class ApiFailure:
    reason: str
    detail: str
    status_code: int | None = None


def classify_http_error(exc: Exception) -> ApiFailure:
    if isinstance(exc, httpx.TimeoutException):
        return ApiFailure(reason="timeout", detail="Upstream request timed out")
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        if status == 401:
            return ApiFailure(reason="invalid_credentials", detail="Invalid API credentials", status_code=status)
        if status == 429:
            return ApiFailure(reason="rate_limited", detail="Rate limit reached", status_code=status)
        if status >= 500:
            return ApiFailure(reason="upstream_error", detail="Upstream service error", status_code=status)
        return ApiFailure(reason="request_failed", detail=f"Request failed with status {status}", status_code=status)
    if isinstance(exc, httpx.RequestError):
        return ApiFailure(reason="network_error", detail="Network request failed")
    return ApiFailure(reason="unknown_error", detail=str(exc)[:400] or "Unknown error")


async def request_json(
    method: str,
    url: str,
    *,
    timeout: float = 10.0,
    params: dict[str, Any] | None = None,
    json: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> tuple[dict[str, Any] | list[Any] | None, ApiFailure | None]:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.request(method=method.upper(), url=url, params=params, json=json, headers=headers)
            response.raise_for_status()
            return response.json(), None
    except Exception as exc:
        failure = classify_http_error(exc)
        log.warning("External API call failed %s %s: %s", method.upper(), url, failure.reason)
        return None, failure
