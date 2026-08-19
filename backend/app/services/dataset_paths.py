"""Normalize and preserve original dataset folder paths."""
from __future__ import annotations

from pathlib import PurePosixPath

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".jfif",
    ".png",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
    ".gif",
    ".ico",
    ".ppm",
    ".pgm",
    ".pbm",
}

SKIP_DIR_NAMES = {"__macosx", ".git", ".svn", "thumbs.db"}
SKIP_FILE_NAMES = {".ds_store", "thumbs.db", "desktop.ini", ".gitkeep"}

MAX_IMAGE_BYTES = 5 * 1024 * 1024 * 1024
MAX_ZIP_BYTES = 12 * 1024 * 1024 * 1024
MAX_ZIP_MEMBERS = 200_000
MAX_ZIP_RATIO = 120


def is_image_name(name: str) -> bool:
    return PurePosixPath(name).suffix.lower() in IMAGE_EXTENSIONS


def normalize_relative_path(raw: str | None) -> str:
    if not raw:
        return ""
    text = str(raw).replace("\\", "/").strip()
    if text.startswith("./"):
        text = text[2:]
    parts: list[str] = []
    for part in text.split("/"):
        piece = part.strip()
        if not piece or piece == ".":
            continue
        if piece == "..":
            raise ValueError("Path traversal is not allowed")
        lower = piece.lower()
        if lower in SKIP_DIR_NAMES or lower.startswith("._"):
            return ""
        parts.append(piece)
    return "/".join(parts)


def parent_folder_of(relative_path: str) -> str:
    if "/" not in relative_path:
        return ""
    return relative_path.rsplit("/", 1)[0]


def filename_of(relative_path: str) -> str:
    return relative_path.rsplit("/", 1)[-1] if relative_path else ""


def storage_key(dataset_id: str, relative_path: str) -> str:
    return f"datasets/{dataset_id}/files/{relative_path}"


def thumbnail_key(dataset_id: str, relative_path: str) -> str:
    stem = PurePosixPath(relative_path).with_suffix("").as_posix()
    return f"datasets/{dataset_id}/thumbs/{stem}.jpg"
