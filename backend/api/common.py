from __future__ import annotations

from fastapi import HTTPException, status


def ok(data=None, message: str = "ok") -> dict:
    return {"success": True, "message": message, "data": data}


def err(message: str, code: int = status.HTTP_400_BAD_REQUEST) -> HTTPException:
    return HTTPException(status_code=code, detail=message)
