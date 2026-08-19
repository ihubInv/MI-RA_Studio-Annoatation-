"""Video processing — metadata, thumbnails, proxies, frame index."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.modules.video.frame_index import PROCESSING_VERSION, build_frame_index
from app.modules.video.paths import (
    LARGE_VIDEO_BYTES,
    LARGE_VIDEO_HEIGHT,
    PROXY_HEIGHTS,
    preview_thumb_key,
    proxy_key,
)
from app.modules.video.probe import extract_poster_frame, probe_video_path
from app.services.dataset_paths import thumbnail_key
from app.services.storage_service import LocalStorageBackend, StorageService, get_storage_backend


@dataclass
class VideoProcessResult:
    probe: dict[str, Any]
    width: int
    height: int
    fps: float
    duration_seconds: float
    frame_count: int | None
    thumbnail_path: str | None = None
    preview_thumbnail_path: str | None = None
    preview_path: str | None = None
    proxies: dict[str, str] = field(default_factory=dict)
    meta: dict[str, Any] = field(default_factory=dict)


def _ffmpeg_path() -> str:
    return shutil.which("ffmpeg") or "ffmpeg"


def _run_ffmpeg(args: list[str]) -> None:
    proc = subprocess.run([_ffmpeg_path(), *args], capture_output=True, text=True, check=False)
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "ffmpeg failed").strip()
        raise RuntimeError(err)


def _extract_keyframe_timestamps(path: str, *, max_keyframes: int = 200) -> list[float]:
    cmd = [
        shutil.which("ffprobe") or "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "packet=pts_time,flags",
        "-of",
        "csv=p=0",
        "-read_intervals",
        "%+#300",
        path,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except FileNotFoundError:
        return [0.0]
    if proc.returncode != 0:
        return [0.0]

    stamps: list[float] = []
    for line in (proc.stdout or "").splitlines():
        parts = line.strip().split(",")
        if len(parts) < 2:
            continue
        ts_raw, flags = parts[0], parts[1]
        if "K" not in flags.upper():
            continue
        try:
            stamps.append(float(ts_raw))
        except ValueError:
            continue
        if len(stamps) >= max_keyframes:
            break
    return stamps or [0.0]


def _generate_proxy(source: str, output: str, height: int) -> None:
    _run_ffmpeg(
        [
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            source,
            "-vf",
            f"scale=-2:{height}",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            output,
        ]
    )


def _should_generate_proxies(file_size: int, height: int) -> bool:
    return file_size >= LARGE_VIDEO_BYTES or height > LARGE_VIDEO_HEIGHT


def _proxy_targets(source_height: int) -> list[int]:
    return [h for h in PROXY_HEIGHTS if h < source_height]


def _pick_annotation_proxy(proxies: dict[str, str], source_height: int) -> tuple[str | None, str | None]:
    if not proxies:
        return None, None
    for height in (720, 1080, 360):
        key = str(height)
        if key in proxies and source_height > height:
            return proxies[key], f"proxy_{height}p"
    first_key = next(iter(proxies))
    return proxies[first_key], f"proxy_{first_key}p"


def process_video_file(
    *,
    local_path: str | Path,
    dataset_id: str,
    relative_path: str,
    file_size_bytes: int,
    storage: StorageService | None = None,
) -> VideoProcessResult:
    storage = storage or StorageService()
    path = str(local_path)
    probe = probe_video_path(path)
    if probe.get("error"):
        raise RuntimeError(probe["error"])

    width = int(probe.get("width") or 0)
    height = int(probe.get("height") or 0)
    fps = float(probe.get("fps") or 0)
    duration = float(probe.get("duration_sec") or 0)
    frame_count = probe.get("frame_count")
    if frame_count is None and duration > 0 and fps > 0:
        frame_count = int(round(duration * fps))

    keyframes = _extract_keyframe_timestamps(path)
    probe.setdefault("gop", {})
    probe["gop"]["keyframe_timestamps_sec"] = keyframes[:200]

    thumb_rel = thumbnail_key(dataset_id, relative_path)
    preview_thumb_rel = preview_thumb_key(dataset_id, relative_path)
    thumbnail_path = None
    preview_thumbnail_path = None

    poster = extract_poster_frame(path, at_sec=0.0)
    if poster:
        _upload_sync(storage, poster, thumb_rel, "image/jpeg")
        thumbnail_path = thumb_rel

    preview_at = min(max(duration * 0.1, 0.0), max(duration - 0.05, 0.0)) if duration > 0 else 0.0
    preview_frame = extract_poster_frame(path, at_sec=preview_at)
    if preview_frame:
        _upload_sync(storage, preview_frame, preview_thumb_rel, "image/jpeg")
        preview_thumbnail_path = preview_thumb_rel

    proxies: dict[str, str] = {}
    preview_path = None
    annotation_source = "original"

    if _should_generate_proxies(file_size_bytes, height):
        with tempfile.TemporaryDirectory() as tmpdir:
            for target_height in _proxy_targets(height):
                out_local = Path(tmpdir) / f"proxy_{target_height}p.mp4"
                _generate_proxy(path, str(out_local), target_height)
                rel = proxy_key(dataset_id, relative_path, target_height)
                _upload_sync(storage, out_local.read_bytes(), rel, "video/mp4")
                proxies[str(target_height)] = rel

        preview_path, annotation_source = _pick_annotation_proxy(proxies, height)

    frame_index = build_frame_index(probe, keyframe_timestamps=keyframes)
    meta = {
        **probe,
        "processing_version": PROCESSING_VERSION,
        "thumbnails": {
            "poster": thumbnail_path,
            "preview": preview_thumbnail_path,
        },
        "proxies": proxies,
        "annotation_playback": {
            "source": annotation_source,
            "path": preview_path or None,
        },
        "frame_index": frame_index,
    }

    return VideoProcessResult(
        probe=probe,
        width=width,
        height=height,
        fps=fps,
        duration_seconds=duration,
        frame_count=int(frame_count) if frame_count is not None else None,
        thumbnail_path=thumbnail_path,
        preview_thumbnail_path=preview_thumbnail_path,
        preview_path=preview_path,
        proxies=proxies,
        meta=meta,
    )


def _upload_sync(storage: StorageService, data: bytes, object_name: str, content_type: str) -> None:
    backend = get_storage_backend()
    if isinstance(backend, LocalStorageBackend):
        path = backend.resolve_local_path(object_name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return
    import asyncio

    asyncio.run(storage.upload_bytes(data, object_name, content_type))


def resolve_local_video_path(storage_path: str) -> Path:
    backend = get_storage_backend()
    if isinstance(backend, LocalStorageBackend):
        return backend.resolve_local_path(storage_path)
    raise RuntimeError("Video processing requires local storage or a downloaded copy")
