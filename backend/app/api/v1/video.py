"""Video module API — probe, frame index, processing status."""
from __future__ import annotations

import hashlib
import hmac
import time
import uuid
from pathlib import Path
from urllib.parse import urlparse

from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel, HttpUrl
from sqlalchemy import select

from app.api.deps import CurrentUser, DB
from app.config import settings
from app.models.dataset_item import DatasetItem
from app.modules.video.audio import extract_waveform_peaks
from app.modules.video.frame_index import lookup_frame
from app.modules.video.process import resolve_local_video_path
from app.modules.video.tasks import schedule_video_processing
from app.api.v1 import video_ai

router = APIRouter()
router.include_router(video_ai.router)


class WaveformResponse(BaseModel):
    duration_sec: float
    sample_rate: int
    buckets: int
    peaks: list[float]


class FrameLookupResponse(BaseModel):
    frame_index: int
    time_sec: float


class VideoProbeResponse(BaseModel):
    item_id: uuid.UUID
    status: str
    width: int | None
    height: int | None
    fps: float | None
    duration_seconds: float | None
    frame_count: int | None
    codec: str | None = None
    bitrate_bps: int | None = None
    audio: dict | None = None
    thumbnail_url: str | None = None
    preview_thumbnail_url: str | None = None
    media_url: str | None = None
    preview_url: str | None = None
    proxies: dict[str, str] = {}
    frame_index: dict | None = None
    processing_error: str | None = None


def _media_url(path: str | None) -> str | None:
    if not path or path.startswith("local:"):
        return None
    return f"{settings.STORAGE_BASE_URL.rstrip('/')}/{path.lstrip('/')}"


async def _get_video_item(db, item_id: uuid.UUID) -> DatasetItem:
    result = await db.execute(select(DatasetItem).where(DatasetItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Video not found")
    return item


@router.get("/{item_id}/probe", response_model=VideoProbeResponse)
async def get_video_probe(item_id: uuid.UUID, current_user: CurrentUser, db: DB):
    item = await _get_video_item(db, item_id)
    meta = item.meta or {}
    probe = meta.get("probe") or meta
    thumbs = meta.get("thumbnails") or {}
    playback = meta.get("annotation_playback") or {}
    preview_storage = item.preview_path or playback.get("path")
    return VideoProbeResponse(
        item_id=item.id,
        status=getattr(item.status, "value", str(item.status)),
        width=item.width,
        height=item.height,
        fps=item.fps,
        duration_seconds=item.duration_seconds,
        frame_count=item.frame_count,
        codec=probe.get("codec"),
        bitrate_bps=probe.get("bitrate_bps"),
        audio=probe.get("audio"),
        thumbnail_url=_media_url(item.thumbnail_path or thumbs.get("poster")),
        preview_thumbnail_url=_media_url(thumbs.get("preview")),
        media_url=_media_url(item.storage_path),
        preview_url=_media_url(preview_storage),
        proxies=meta.get("proxies") or {},
        frame_index=meta.get("frame_index"),
        processing_error=meta.get("processing_error"),
    )


@router.get("/{item_id}/frame-index")
async def get_frame_index(item_id: uuid.UUID, current_user: CurrentUser, db: DB):
    item = await _get_video_item(db, item_id)
    meta = item.meta or {}
    frame_index = meta.get("frame_index")
    if not frame_index:
        raise HTTPException(status_code=409, detail="Frame index not ready — video is still processing")
    return frame_index


@router.get("/{item_id}/frames/lookup", response_model=FrameLookupResponse)
async def lookup_video_frame(
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    frame_index: int | None = Query(None, ge=0),
    time_sec: float | None = Query(None, ge=0),
):
    item = await _get_video_item(db, item_id)
    meta = item.meta or {}
    index = meta.get("frame_index")
    if not index:
        if item.fps and item.duration_seconds is not None:
            index = {
                "fps": item.fps,
                "fps_rational": meta.get("fps_rational") or (meta.get("probe") or {}).get("fps_rational"),
                "frame_count": item.frame_count,
                "duration_sec": item.duration_seconds,
            }
        else:
            raise HTTPException(status_code=409, detail="Frame index not ready — video is still processing")
    try:
        result = lookup_frame(index, frame=frame_index, time_sec=time_sec)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FrameLookupResponse(**result)


@router.get("/{item_id}/audio/waveform", response_model=WaveformResponse)
async def get_audio_waveform(
    item_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    buckets: int = Query(2048, ge=64, le=8192),
):
    """Task 22.1 — extract normalized waveform peaks for timeline display."""
    _ = current_user
    item = await _get_video_item(db, item_id)
    storage_path = item.storage_path or ""
    if storage_path.startswith("local:"):
        raise HTTPException(
            status_code=400,
            detail="Local attach videos use client-side audio extraction",
        )
    try:
        local = resolve_local_video_path(storage_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not local.is_file():
        raise HTTPException(status_code=404, detail="Video file not found on server")
    try:
        data = extract_waveform_peaks(local, buckets=buckets)
    except RuntimeError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return WaveformResponse(**data)


@router.post("/{item_id}/process")
async def reprocess_video(item_id: uuid.UUID, current_user: CurrentUser, db: DB):
    item = await _get_video_item(db, item_id)
    if (item.storage_path or "").startswith("local:"):
        raise HTTPException(status_code=400, detail="Local attach videos are not processed on the server")
    from app.models.dataset_item import ItemStatus

    item.status = ItemStatus.PROCESSING
    meta = dict(item.meta or {})
    meta["processing_status"] = "queued"
    item.meta = meta
    await db.commit()
    schedule_video_processing(str(item.id), item.storage_path)
    return {"status": "processing", "item_id": str(item.id)}


class ImportUrlBody(BaseModel):
    dataset_id: uuid.UUID
    url: HttpUrl
    filename: str | None = None


@router.post("/import-url")
async def import_video_url(payload: ImportUrlBody, current_user: CurrentUser, db: DB):
    """Download a remote video and ingest it into a dataset."""
    import urllib.request

    from app.modules.video.ingest import ingest_video_bytes

    parsed = urlparse(str(payload.url))
    name = payload.filename or Path(parsed.path).name or "download.mp4"
    try:
        with urllib.request.urlopen(str(payload.url), timeout=120) as resp:
            data = resp.read()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Download failed: {exc}") from exc
    item, error = await ingest_video_bytes(
        db=db,
        dataset_id=payload.dataset_id,
        relative_path=name,
        data=data,
        mime_type=None,
    )
    if error:
        raise HTTPException(status_code=422, detail=error)
    return {"item_id": str(item.id), "filename": item.filename}


@router.post("/import-sequence")
async def import_image_sequence(
    current_user: CurrentUser,
    db: DB,
    dataset_id: uuid.UUID = Form(...),
    fps: float = Form(30),
    files: list[UploadFile] = File(...),
):
    """Build an MP4 from an ordered image sequence via FFmpeg, then ingest."""
    import shutil
    import subprocess
    import tempfile

    from app.modules.video.ingest import ingest_video_bytes

    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 images")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise HTTPException(status_code=503, detail="FFmpeg is required to convert image sequences")
    with tempfile.TemporaryDirectory() as td:
        folder = Path(td)
        for i, f in enumerate(files):
            ext = Path(f.filename or "frame.jpg").suffix or ".jpg"
            (folder / f"frame_{i:05d}{ext}").write_bytes(await f.read())
        out = folder / "sequence.mp4"
        proc = subprocess.run(
            [
                ffmpeg,
                "-y",
                "-framerate",
                str(max(1, fps)),
                "-i",
                str(folder / "frame_%05d.jpg"),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                str(out),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode != 0 or not out.is_file():
            # try png
            proc = subprocess.run(
                [
                    ffmpeg,
                    "-y",
                    "-framerate",
                    str(max(1, fps)),
                    "-pattern_type",
                    "glob",
                    "-i",
                    str(folder / "frame_*"),
                    "-c:v",
                    "libx264",
                    "-pix_fmt",
                    "yuv420p",
                    str(out),
                ],
                capture_output=True,
                text=True,
                check=False,
            )
        if proc.returncode != 0 or not out.is_file():
            raise HTTPException(status_code=422, detail=(proc.stderr or "ffmpeg failed")[-400:])
        data = out.read_bytes()
    item, error = await ingest_video_bytes(
        db=db,
        dataset_id=dataset_id,
        relative_path="sequence.mp4",
        data=data,
        mime_type="video/mp4",
    )
    if error:
        raise HTTPException(status_code=422, detail=error)
    return {"item_id": str(item.id), "frames": len(files), "fps": fps}


@router.post("/{item_id}/render-annotated")
async def render_annotated_mp4(item_id: uuid.UUID, current_user: CurrentUser, db: DB):
    """Burn timestamps onto a server-side video with FFmpeg (full file, MP4)."""
    import shutil
    import subprocess
    import tempfile

    from app.modules.video.process import resolve_local_video_path
    from app.services.storage_service import StorageService

    item = await _get_video_item(db, item_id)
    if (item.storage_path or "").startswith("local:"):
        raise HTTPException(status_code=400, detail="Local attach videos: use the studio Render button")
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise HTTPException(status_code=503, detail="FFmpeg is required for MP4 render")
    try:
        src = resolve_local_video_path(item.storage_path)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    with tempfile.TemporaryDirectory() as td:
        out = Path(td) / "annotated.mp4"
        vf = "drawtext=text='%{n}  %{pts\\:hms}':fontcolor=white:fontsize=24:x=20:y=h-40:box=1:boxcolor=black@0.4"
        proc = subprocess.run(
            [ffmpeg, "-y", "-i", str(src), "-vf", vf, "-c:a", "copy", "-movflags", "+faststart", str(out)],
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode != 0 or not out.is_file():
            raise HTTPException(status_code=422, detail=(proc.stderr or "ffmpeg failed")[-400:])
        stored = f"exports/{item_id}/annotated.mp4"
        await StorageService().upload_bytes(out.read_bytes(), stored, "video/mp4")
    url = f"{settings.STORAGE_BASE_URL.rstrip('/')}/{stored}"
    return {"url": url, "storage_path": stored}


@router.get("/{item_id}/signed-url")
async def signed_download(item_id: uuid.UUID, current_user: CurrentUser, db: DB, expires: int = Query(3600, ge=60, le=86400)):
    item = await _get_video_item(db, item_id)
    path = item.preview_path or item.storage_path
    if not path or path.startswith("local:"):
        raise HTTPException(status_code=400, detail="No server file to sign")
    exp = int(time.time()) + expires
    sig = hmac.new(settings.JWT_SECRET.encode(), f"{path}:{exp}".encode(), hashlib.sha256).hexdigest()
    base = settings.STORAGE_BASE_URL.rstrip("/")
    return {"url": f"{base}/{path}?exp={exp}&sig={sig}", "expires_at": exp}
