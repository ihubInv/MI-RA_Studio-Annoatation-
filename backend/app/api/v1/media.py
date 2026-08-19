"""Serve uploaded media when using local filesystem storage."""
from pathlib import Path
import hashlib
import hmac
import time

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from app.config import settings
from app.services.storage_service import LocalStorageBackend, get_storage_backend

router = APIRouter()


def _valid_sig(object_path: str, exp: str | None, sig: str | None) -> bool:
    if not exp or not sig:
        return True  # unsigned still allowed in local dev
    try:
        if int(exp) < time.time():
            return False
    except ValueError:
        return False
    expected = hmac.new(settings.JWT_SECRET.encode(), f"{object_path}:{exp}".encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)


@router.get("/{object_path:path}")
async def get_media_file(object_path: str, exp: str | None = Query(None), sig: str | None = Query(None)):
    if settings.STORAGE_BACKEND != "local":
        raise HTTPException(
            status_code=404,
            detail="Direct media serving is only available with local storage",
        )
    if not _valid_sig(object_path, exp, sig) and settings.APP_ENV == "production":
        raise HTTPException(status_code=403, detail="Invalid or expired download URL")

    backend = get_storage_backend()
    if not isinstance(backend, LocalStorageBackend):
        raise HTTPException(status_code=404, detail="Local storage backend not active")

    file_path = backend.resolve_local_path(object_path)
    root = Path(settings.LOCAL_STORAGE_ROOT).resolve()

    if not file_path.exists() or not str(file_path.resolve()).startswith(str(root)):
        raise HTTPException(status_code=404, detail="File not found")

    return FileResponse(
        file_path,
        headers={"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET"},
    )
