"""Local image processing: dimensions, thumbnail, metadata."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

from PIL import Image, UnidentifiedImageError

from app.services.storage_service import LocalStorageBackend, get_storage_backend


THUMB_MAX = 320


@dataclass
class ImageProcessResult:
    width: int
    height: int
    thumbnail_path: Optional[str]
    metadata: dict[str, Any]


def process_local_image(storage_path: str) -> ImageProcessResult:
    backend = get_storage_backend()
    if not isinstance(backend, LocalStorageBackend):
        raise RuntimeError("Inline image processing currently supports local storage only")

    source = backend.resolve_local_path(storage_path)
    if not source.exists():
        raise FileNotFoundError(storage_path)

    try:
        with Image.open(source) as img:
            img = img.convert("RGB") if img.mode not in ("RGB", "L") else img
            width, height = img.size
            fmt = img.format or Path(source).suffix.lstrip(".").upper()
            metadata: dict[str, Any] = {"format": fmt, "mode": img.mode}

            thumb = img.copy()
            thumb.thumbnail((THUMB_MAX, THUMB_MAX))
            thumb_rel = _thumbnail_relpath(storage_path)
            thumb_abs = backend.resolve_local_path(thumb_rel)
            thumb_abs.parent.mkdir(parents=True, exist_ok=True)
            thumb.save(thumb_abs, format="JPEG", quality=82)
    except UnidentifiedImageError as exc:
        raise ValueError(f"Not a valid image: {storage_path}") from exc

    return ImageProcessResult(
        width=width,
        height=height,
        thumbnail_path=thumb_rel,
        metadata=metadata,
    )


def _thumbnail_relpath(storage_path: str) -> str:
    path = Path(storage_path.replace("\\", "/"))
    return str(path.parent / "thumbnails" / f"{path.stem}.jpg").replace("\\", "/")
