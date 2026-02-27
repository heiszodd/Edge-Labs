from __future__ import annotations

import logging
import asyncio
from dataclasses import dataclass
from typing import Any

import httpx

log = logging.getLogger(__name__)


@dataclass
class ApiFailure:
    reason: str
    detail: str
    status_code: int | None = None
    response_body: str | None = None


def classify_http_error(exc: Exception) -> ApiFailure:
    if isinstance(exc, httpx.TimeoutException):
        return ApiFailure(reason="timeout", detail="Upstream request timed out")
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        body = ""
        try:
            body = exc.response.text[:2000]
        except Exception:
            body = ""
        if status == 401:
            return ApiFailure(reason="invalid_credentials", detail="Invalid API credentials", status_code=status, response_body=body)
        if status == 422:
            return ApiFailure(reason="invalid_request", detail="Invalid request payload", status_code=status, response_body=body)
        if status == 429:
            return ApiFailure(reason="rate_limited", detail="Rate limit reached", status_code=status, response_body=body)
        if status >= 500:
            return ApiFailure(reason="upstream_error", detail="Upstream service error", status_code=status, response_body=body)
        return ApiFailure(reason="request_failed", detail=f"Request failed with status {status}", status_code=status, response_body=body)
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
    max_attempts = 3
    for attempt in range(max_attempts):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.request(method=method.upper(), url=url, params=params, json=json, headers=headers)
                response.raise_for_status()
                return response.json(), None
        except Exception as exc:
            failure = classify_http_error(exc)
            if failure.status_code == 422 and failure.response_body:
                log.error("422 body for %s %s: %s", method.upper(), url, failure.response_body)
            retriable = failure.reason in {"timeout", "network_error", "upstream_error", "rate_limited"}
            if retriable and attempt < max_attempts - 1:
                await asyncio.sleep(0.35 * (attempt + 1))
                continue
            log.warning("External API call failed %s %s: %s", method.upper(), url, failure.reason)
            return None, failure
    return None, ApiFailure(reason="unknown_error", detail="request_failed_after_retries")
