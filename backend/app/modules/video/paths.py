"""Video file path helpers and limits."""
from __future__ import annotations

from pathlib import PurePosixPath

VIDEO_EXTENSIONS = {
    ".mp4",
    ".avi",
    ".mov",
    ".mkv",
    ".webm",
    ".mpeg",
    ".mpg",
    ".m4v",
    ".wmv",
    ".flv",
    ".ts",
    ".mts",
    ".m2ts",
    ".3gp",
}

MAX_VIDEO_BYTES = 10 * 1024 * 1024 * 1024
PROXY_HEIGHTS = (360, 720, 1080)
LARGE_VIDEO_BYTES = 50 * 1024 * 1024
LARGE_VIDEO_HEIGHT = 720


def is_video_name(name: str) -> bool:
    return PurePosixPath(name).suffix.lower() in VIDEO_EXTENSIONS


def proxy_key(dataset_id: str, relative_path: str, height: int) -> str:
    stem = PurePosixPath(relative_path).with_suffix("").as_posix()
    return f"datasets/{dataset_id}/proxies/{stem}_{height}p.mp4"


def preview_thumb_key(dataset_id: str, relative_path: str) -> str:
    stem = PurePosixPath(relative_path).with_suffix("").as_posix()
    return f"datasets/{dataset_id}/thumbs/{stem}_preview.jpg"
