"""Ingest images while preserving original relative paths."""
from __future__ import annotations

import asyncio
import io
import json
import mimetypes
import uuid
import zipfile
from pathlib import Path
from typing import Any

from PIL import Image, UnidentifiedImageError

from app.config import settings
from app.models.dataset_item import DatasetItem, ItemStatus
from app.repositories.dataset_repo import DatasetItemRepository, DatasetRepository
from app.services.dataset_paths import (
    MAX_IMAGE_BYTES,
    MAX_ZIP_BYTES,
    MAX_ZIP_MEMBERS,
    MAX_ZIP_RATIO,
    SKIP_FILE_NAMES,
    filename_of,
    is_image_name,
    normalize_relative_path,
    parent_folder_of,
    storage_key,
    thumbnail_key,
)
from app.services.storage_service import LocalStorageBackend, StorageService, get_storage_backend


JOBS_DIR_NAME = "_zip_jobs"
INGEST_CONCURRENCY = 8


def _jobs_root() -> Path:
    root = Path(settings.LOCAL_STORAGE_ROOT).resolve() / JOBS_DIR_NAME
    root.mkdir(parents=True, exist_ok=True)
    return root


def guess_mime(name: str) -> str:
    return mimetypes.guess_type(name)[0] or "application/octet-stream"


def process_image_bytes(data: bytes, thumb_rel: str) -> dict[str, Any]:
    with Image.open(io.BytesIO(data)) as img:
        img = img.convert("RGB") if img.mode not in ("RGB", "L") else img
        width, height = img.size
        fmt = img.format or "JPEG"
        thumb = img.copy()
        thumb.thumbnail((320, 320))
        backend = get_storage_backend()
        buf = io.BytesIO()
        thumb.save(buf, format="JPEG", quality=82)
        thumb_bytes = buf.getvalue()
        if isinstance(backend, LocalStorageBackend):
            dest = backend.resolve_local_path(thumb_rel)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(thumb_bytes)
        return {
            "width": width,
            "height": height,
            "thumbnail_path": thumb_rel,
            "meta": {"format": fmt, "mode": img.mode},
            "thumb_bytes": None if isinstance(backend, LocalStorageBackend) else thumb_bytes,
        }


async def ingest_image_bytes(
    *,
    db,
    dataset_id: uuid.UUID,
    relative_path: str,
    data: bytes,
    mime_type: str | None = None,
) -> DatasetItem:
    rel = normalize_relative_path(relative_path)
    if not rel or not is_image_name(rel):
        raise ValueError("Not a supported image path")
    if len(data) > MAX_IMAGE_BYTES:
        raise ValueError("File exceeds 5GB limit")

    item_repo = DatasetItemRepository(db)
    existing = await item_repo.get_by_relative_path(dataset_id, rel)
    if existing:
        return existing

    mime = mime_type or guess_mime(rel)
    stored = storage_key(str(dataset_id), rel)
    thumb_rel = thumbnail_key(str(dataset_id), rel)
    storage = StorageService()
    await storage.upload_bytes(data, stored, mime)

    width = height = None
    thumbnail_path = None
    meta = None
    status_value = ItemStatus.READY
    try:
        result = await asyncio.to_thread(process_image_bytes, data, thumb_rel)
        width, height = result["width"], result["height"]
        thumbnail_path = result["thumbnail_path"]
        meta = result["meta"]
        if result.get("thumb_bytes"):
            await storage.upload_bytes(result["thumb_bytes"], thumb_rel, "image/jpeg")
    except (UnidentifiedImageError, OSError, ValueError):
        status_value = ItemStatus.ERROR

    item = DatasetItem(
        dataset_id=dataset_id,
        filename=filename_of(rel),
        original_filename=filename_of(rel),
        relative_path=rel,
        parent_folder=parent_folder_of(rel),
        storage_path=stored,
        mime_type=mime,
        file_size_bytes=len(data),
        status=status_value,
        width=width,
        height=height,
        thumbnail_path=thumbnail_path,
        meta=meta,
    )
    return await item_repo.create(item)


def inspect_zip_file(zip_path: Path) -> dict[str, Any]:
    if zip_path.stat().st_size > MAX_ZIP_BYTES:
        raise ValueError("ZIP exceeds 12GB limit")

    folders: set[str] = set()
    valid: list[dict[str, Any]] = []
    unsupported: list[str] = []
    duplicates: list[str] = []
    large_files: list[str] = []
    invalid_paths: list[str] = []
    seen_paths: dict[str, int] = {}
    crc_index: dict[tuple[int, int], list[str]] = {}
    uncompressed = 0

    try:
        zf = zipfile.ZipFile(zip_path)
    except zipfile.BadZipFile as exc:
        raise ValueError("Invalid or corrupted ZIP archive") from exc

    with zf:
        infos = zf.infolist()
        if len(infos) > MAX_ZIP_MEMBERS:
            raise ValueError(f"ZIP has more than {MAX_ZIP_MEMBERS} entries")

        for info in infos:
            name = info.filename.replace("\\", "/")
            if name.endswith("/"):
                try:
                    folder = normalize_relative_path(name.rstrip("/"))
                except ValueError:
                    invalid_paths.append(name)
                    continue
                if folder:
                    folders.add(folder)
                continue

            base = name.rsplit("/", 1)[-1]
            if base.lower() in SKIP_FILE_NAMES or base.startswith("._"):
                continue

            try:
                rel = normalize_relative_path(name)
            except ValueError:
                invalid_paths.append(name)
                continue
            if not rel:
                continue

            folders.add(parent_folder_of(rel)) if parent_folder_of(rel) else None
            # include all ancestor folders
            parts = rel.split("/")[:-1]
            acc = []
            for part in parts:
                acc.append(part)
                folders.add("/".join(acc))

            uncompressed += info.file_size
            if info.file_size > MAX_IMAGE_BYTES:
                large_files.append(rel)
                continue

            if not is_image_name(rel):
                unsupported.append(rel)
                continue

            seen_paths[rel] = seen_paths.get(rel, 0) + 1
            crc_index.setdefault((info.file_size, info.CRC), []).append(rel)
            valid.append(
                {
                    "relative_path": rel,
                    "size": info.file_size,
                    "crc": info.CRC,
                }
            )

        compressed = max(zip_path.stat().st_size, 1)
        if uncompressed / compressed > MAX_ZIP_RATIO and uncompressed > 500 * 1024 * 1024:
            raise ValueError("ZIP compression ratio looks unsafe")

    path_dups = [p for p, n in seen_paths.items() if n > 1]
    content_dups = []
    for paths in crc_index.values():
        unique = list(dict.fromkeys(paths))
        if len(unique) > 1:
            content_dups.extend(unique)

    duplicates = list(dict.fromkeys(path_dups + content_dups))
    empty_folders = sorted(f for f in folders if f and not any(v["relative_path"].startswith(f + "/") or parent_folder_of(v["relative_path"]) == f for v in valid))

    return {
        "valid_images": len(valid),
        "folder_count": len([f for f in folders if f]),
        "folders": sorted(f for f in folders if f),
        "duplicate_files": duplicates[:200],
        "duplicate_count": len(duplicates),
        "unsupported_files": unsupported[:200],
        "unsupported_count": len(unsupported),
        "large_files": large_files,
        "invalid_paths": invalid_paths[:50],
        "empty_folders": empty_folders[:50],
        "corrupted_images": [],
        "members": valid,
    }


def save_zip_job(dataset_id: str, zip_bytes: bytes) -> tuple[str, dict[str, Any]]:
    job_id = uuid.uuid4().hex
    zip_path = _jobs_root() / f"{job_id}.zip"
    zip_path.write_bytes(zip_bytes)
    report = inspect_zip_file(zip_path)
    payload = {
        "job_id": job_id,
        "dataset_id": dataset_id,
        "zip_path": str(zip_path),
        "report": {k: v for k, v in report.items() if k != "members"},
        "member_count": len(report["members"]),
    }
    (_jobs_root() / f"{job_id}.json").write_text(json.dumps(payload), encoding="utf-8")
    report_out = payload["report"] | {
        "job_id": job_id,
        "valid_images": report["valid_images"],
        "folder_count": report["folder_count"],
        "folders": report["folders"][:80],
    }
    return job_id, report_out


def load_zip_job(job_id: str) -> dict[str, Any]:
    meta_path = _jobs_root() / f"{job_id}.json"
    if not meta_path.exists():
        raise FileNotFoundError("ZIP import job expired or was not found")
    return json.loads(meta_path.read_text(encoding="utf-8"))


async def import_zip_job(db, dataset_id: uuid.UUID, job_id: str) -> dict[str, Any]:
    job = load_zip_job(job_id)
    if job["dataset_id"] != str(dataset_id):
        raise ValueError("ZIP job does not belong to this dataset")
    zip_path = Path(job["zip_path"])
    if not zip_path.exists():
        raise FileNotFoundError("ZIP file is no longer available")

    dataset_repo = DatasetRepository(db)
    item_repo = DatasetItemRepository(db)
    dataset = await dataset_repo.get_by_id(dataset_id)
    if not dataset:
        raise FileNotFoundError("Dataset not found")

    sem = asyncio.Semaphore(INGEST_CONCURRENCY)
    created = 0
    skipped = 0
    corrupted = 0
    lock = asyncio.Lock()
    folders: set[str] = set()

    async def handle(rel: str, payload: bytes) -> None:
        nonlocal created, skipped, corrupted
        async with sem:
            existing = await item_repo.get_by_relative_path(dataset_id, rel)
            if existing:
                async with lock:
                    skipped += 1
                return
            parent = parent_folder_of(rel)
            if parent:
                folders.add(parent)
            item = await ingest_image_bytes(
                db=db,
                dataset_id=dataset_id,
                relative_path=rel,
                data=payload,
            )
            async with lock:
                if item.status == ItemStatus.ERROR:
                    corrupted += 1
                else:
                    created += 1

    def collect_members() -> list[tuple[str, str]]:
        pairs: list[tuple[str, str]] = []
        with zipfile.ZipFile(zip_path) as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                try:
                    rel = normalize_relative_path(info.filename)
                except ValueError:
                    continue
                if not rel or not is_image_name(rel) or info.file_size > MAX_IMAGE_BYTES:
                    continue
                pairs.append((rel, info.filename))
        return pairs

    members = await asyncio.to_thread(collect_members)
    with zipfile.ZipFile(zip_path) as zf:
        tasks: list = []
        seen: set[str] = set()
        for rel, zip_name in members:
            if rel in seen:
                skipped += 1
                continue
            seen.add(rel)
            payload = zf.read(zip_name)
            tasks.append(handle(rel, payload))
            if len(tasks) >= 24:
                await asyncio.gather(*tasks)
                tasks = []
        if tasks:
            await asyncio.gather(*tasks)

    total = await dataset_repo.count_items(dataset_id)
    size = await item_repo.sum_size(dataset_id)
    await dataset_repo.update(dataset, item_count=total, total_size_bytes=size)

    try:
        zip_path.unlink(missing_ok=True)
        (_jobs_root() / f"{job_id}.json").unlink(missing_ok=True)
    except OSError:
        pass

    return {
        "imported": created,
        "skipped_duplicates": skipped,
        "corrupted": corrupted,
        "item_count": total,
        "folder_count": len(folders),
    }
