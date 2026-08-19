"""Video upload validation rules for Phase 1."""
from __future__ import annotations

from pathlib import PurePosixPath

from app.modules.video.paths import MAX_VIDEO_BYTES, VIDEO_EXTENSIONS

SUPPORTED_CONTAINERS = {
    "mp4",
    "mov",
    "avi",
    "mkv",
    "matroska",
    "webm",
    "mpeg",
    "mpegts",
    "ts",
    "wmv",
    "asf",
    "flv",
    "3gp",
    "3g2",
    "m4v",
    "ogg",
}

SUPPORTED_VIDEO_CODECS = {
    "h264",
    "avc1",
    "hevc",
    "h265",
    "vp8",
    "vp9",
    "av1",
    "mpeg4",
    "mpeg2video",
    "mpeg1video",
    "prores",
    "mjpeg",
    "theora",
    "wmv3",
    "vc1",
    "rawvideo",
}

MIN_WIDTH = 16
MIN_HEIGHT = 16
MAX_WIDTH = 8192
MAX_HEIGHT = 8192
MIN_FPS = 0.1
MAX_FPS = 240.0
MIN_DURATION_SEC = 0.05
MAX_DURATION_SEC = 24 * 3600


class VideoValidationError(Exception):
    """Raised when a video fails ingest validation."""

    def __init__(self, message: str, *, field: str | None = None):
        super().__init__(message)
        self.message = message
        self.field = field


def validate_video_probe(probe: dict, *, file_size: int, filename: str = "") -> None:
    if file_size <= 0:
        raise VideoValidationError("File is empty.", field="file_size")
    if file_size > MAX_VIDEO_BYTES:
        limit_gb = MAX_VIDEO_BYTES / (1024**3)
        size_gb = file_size / (1024**3)
        raise VideoValidationError(
            f"File too large: {size_gb:.2f} GB exceeds the {limit_gb:.0f} GB limit.",
            field="file_size",
        )

    if probe.get("error"):
        raise VideoValidationError(
            f"Corrupted or unreadable video: {probe['error']}",
            field="corruption",
        )

    container = str(probe.get("container") or "").lower()
    ext = PurePosixPath(filename).suffix.lower() if filename else ""
    if ext and ext not in VIDEO_EXTENSIONS:
        raise VideoValidationError(
            f"Unsupported file format: {ext}. "
            "Supported extensions: MP4, AVI, MOV, MKV, WebM, MPEG, WMV, FLV, TS, and 3GP.",
            field="format",
        )
    if container and container not in SUPPORTED_CONTAINERS and ext not in VIDEO_EXTENSIONS:
        raise VideoValidationError(
            f"Unsupported file format: {container or ext or 'unknown'}. "
            "Supported containers include MP4, AVI, MOV, MKV, WebM, MPEG, WMV, FLV, TS, and 3GP.",
            field="format",
        )

    codec = str(probe.get("codec") or "").lower()
    if not codec:
        raise VideoValidationError(
            "Corrupted or unreadable video: no video stream found.",
            field="corruption",
        )
    if codec not in SUPPORTED_VIDEO_CODECS:
        supported = "H.264, H.265/HEVC, VP8, VP9, AV1, MPEG-4, ProRes (where FFmpeg supports)"
        raise VideoValidationError(
            f"Unsupported video codec: {codec.upper()}. Supported codecs: {supported}.",
            field="codec",
        )

    width = int(probe.get("width") or 0)
    height = int(probe.get("height") or 0)
    if width < MIN_WIDTH or height < MIN_HEIGHT:
        raise VideoValidationError(
            f"Invalid resolution: {width}×{height}. Video must have readable width and height.",
            field="resolution",
        )
    if width > MAX_WIDTH or height > MAX_HEIGHT:
        raise VideoValidationError(
            f"Resolution too large: {width}×{height}. Maximum supported is {MAX_WIDTH}×{MAX_HEIGHT}.",
            field="resolution",
        )

    fps = float(probe.get("fps") or 0)
    if fps < MIN_FPS or fps > MAX_FPS:
        raise VideoValidationError(
            f"Invalid frame rate: {fps:.3f} FPS. Expected between {MIN_FPS} and {MAX_FPS}.",
            field="fps",
        )

    duration = float(probe.get("duration_sec") or 0)
    if duration < MIN_DURATION_SEC:
        raise VideoValidationError(
            "Invalid duration: video appears empty or corrupt.",
            field="duration",
        )
    if duration > MAX_DURATION_SEC:
        raise VideoValidationError(
            f"Video too long: {duration / 3600:.1f} hours exceeds the 24 hour limit.",
            field="duration",
        )

