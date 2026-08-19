"""Serve uploaded media when using local filesystem storage."""
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.config import settings
from app.services.storage_service import LocalStorageBackend, get_storage_backend

router = APIRouter()


@router.get("/{object_path:path}")
async def get_media_file(object_path: str):
    if settings.STORAGE_BACKEND != "local":
        raise HTTPException(
            status_code=404,
            detail="Direct media serving is only available with local storage",
        )

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
