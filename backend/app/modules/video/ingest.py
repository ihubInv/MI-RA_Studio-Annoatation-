"""Video ingest — probe, validate, store."""
from __future__ import annotations

import asyncio
import mimetypes
import uuid
from pathlib import PurePosixPath

from app.models.dataset_item import DatasetItem, ItemStatus
from app.modules.video.paths import MAX_VIDEO_BYTES, is_video_name
from app.modules.video.probe import probe_video_bytes
from app.modules.video.tasks import schedule_video_processing
from app.modules.video.validation import VideoValidationError, validate_video_probe
from app.repositories.dataset_repo import DatasetItemRepository
from app.services.dataset_paths import filename_of, normalize_relative_path, parent_folder_of, storage_key
from app.services.storage_service import StorageService


def guess_video_mime(name: str) -> str:
    mime = mimetypes.guess_type(name)[0]
    if mime and mime.startswith("video/"):
        return mime
    ext = PurePosixPath(name).suffix.lower()
    mapping = {
        ".mp4": "video/mp4",
        ".m4v": "video/x-m4v",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".mkv": "video/x-matroska",
        ".webm": "video/webm",
        ".mpeg": "video/mpeg",
        ".mpg": "video/mpeg",
        ".wmv": "video/x-ms-wmv",
        ".flv": "video/x-flv",
        ".ts": "video/mp2t",
        ".mts": "video/mp2t",
        ".m2ts": "video/mp2t",
        ".3gp": "video/3gpp",
    }
    return mapping.get(ext, "video/mp4")


async def ingest_video_bytes(
    *,
    db,
    dataset_id: uuid.UUID,
    relative_path: str,
    data: bytes,
    mime_type: str | None = None,
) -> tuple[DatasetItem | None, str | None]:
    """
    Validate and ingest one video file.
    Returns (item, error_message). item is None when rejected.
    """
    rel = normalize_relative_path(relative_path)
    if not rel or not is_video_name(rel):
        return None, "Not a supported video path"

    if len(data) > MAX_VIDEO_BYTES:
        return None, f"File {filename_of(rel)} exceeds 10GB limit"

    item_repo = DatasetItemRepository(db)
    existing = await item_repo.get_by_relative_path(dataset_id, rel)
    if existing:
        return existing, None

    suffix = PurePosixPath(rel).suffix.lower() or ".mp4"
    probe = await asyncio.to_thread(probe_video_bytes, data, suffix=suffix)
    try:
        validate_video_probe(probe, file_size=len(data), filename=filename_of(rel))
    except VideoValidationError as exc:
        return None, exc.message

    mime = mime_type or guess_video_mime(rel)
    stored = storage_key(str(dataset_id), rel)
    storage = StorageService()
    await storage.upload_bytes(data, stored, mime)

    width = int(probe.get("width") or 0)
    height = int(probe.get("height") or 0)
    fps = float(probe.get("fps") or 0)
    duration = float(probe.get("duration_sec") or 0)
    frame_count = probe.get("frame_count")

    item = DatasetItem(
        dataset_id=dataset_id,
        filename=filename_of(rel),
        original_filename=filename_of(rel),
        relative_path=rel,
        parent_folder=parent_folder_of(rel),
        storage_path=stored,
        mime_type=mime,
        file_size_bytes=len(data),
        status=ItemStatus.PROCESSING,
        width=width,
        height=height,
        duration_seconds=duration,
        frame_count=int(frame_count) if frame_count is not None else None,
        fps=fps,
        meta={"probe": probe, "processing_status": "queued"},
    )
    created = await item_repo.create(item)
    await asyncio.to_thread(schedule_video_processing, str(created.id), stored)
    return created, None
