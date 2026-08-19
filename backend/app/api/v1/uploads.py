"""File upload API — images, videos, folders, and ZIP datasets."""
import asyncio
import json
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.api.deps import CurrentUser, DB
from app.models.dataset import DatasetModality
from app.models.dataset_item import DatasetItem
from app.modules.video.ingest import ingest_video_bytes
from app.modules.video.paths import is_video_name
from app.repositories.dataset_repo import DatasetItemRepository, DatasetRepository
from app.services.dataset_ingest import import_zip_job, ingest_image_bytes, save_zip_job
from app.services.dataset_paths import is_image_name, normalize_relative_path

router = APIRouter()

MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024
MAX_VIDEO_FILE_SIZE = 10 * 1024 * 1024 * 1024
MAX_FILES_PER_REQUEST = 64
INGEST_CONCURRENCY = 12


def _parse_relative_paths(raw: str | None, files: list[UploadFile]) -> list[str]:
    if not raw:
        return [file.filename or f"file_{i}" for i, file in enumerate(files)]
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list) and len(parsed) == len(files):
            return [str(p) for p in parsed]
    except json.JSONDecodeError:
        pass
    return [file.filename or f"file_{i}" for i, file in enumerate(files)]


def _is_video_dataset(modality) -> bool:
    value = getattr(modality, "value", str(modality))
    return value in {DatasetModality.VIDEO.value, DatasetModality.MULTIMODAL.value}


@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_files(
    current_user: CurrentUser,
    db: DB,
    dataset_id: uuid.UUID = Form(...),
    files: list[UploadFile] = File(...),
    relative_paths: str | None = Form(None),
):
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(files) > MAX_FILES_PER_REQUEST:
        raise HTTPException(
            status_code=413,
            detail=f"Send at most {MAX_FILES_PER_REQUEST} files per request",
        )

    dataset_repo = DatasetRepository(db)
    dataset = await dataset_repo.get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    video_mode = _is_video_dataset(dataset.modality)
    max_size = MAX_VIDEO_FILE_SIZE if video_mode else MAX_FILE_SIZE
    media_check = is_video_name if video_mode else is_image_name

    paths = _parse_relative_paths(relative_paths, files)
    item_repo = DatasetItemRepository(db)
    sem = asyncio.Semaphore(INGEST_CONCURRENCY)
    created_items: list[DatasetItem] = []
    rejected: list[dict[str, str]] = []
    skipped = 0
    lock = asyncio.Lock()

    async def ingest(file: UploadFile, raw_path: str) -> None:
        nonlocal skipped
        async with sem:
            try:
                rel = normalize_relative_path(raw_path) or normalize_relative_path(file.filename or "")
            except ValueError as exc:
                async with lock:
                    rejected.append({"path": raw_path or file.filename or "unknown", "reason": str(exc)})
                return
            if not rel:
                return
            if not media_check(rel):
                async with lock:
                    skipped += 1
                return
            content = await file.read()
            if len(content) > max_size:
                limit = "10GB" if video_mode else "5GB"
                async with lock:
                    rejected.append(
                        {
                            "path": rel,
                            "reason": f"File exceeds {limit} limit",
                        }
                    )
                return

            if video_mode:
                item, error = await ingest_video_bytes(
                    db=db,
                    dataset_id=dataset_id,
                    relative_path=rel,
                    data=content,
                    mime_type=file.content_type,
                )
                async with lock:
                    if error:
                        rejected.append({"path": rel, "reason": error})
                    elif item:
                        created_items.append(item)
                return

            item = await ingest_image_bytes(
                db=db,
                dataset_id=dataset_id,
                relative_path=rel,
                data=content,
                mime_type=file.content_type,
            )
            async with lock:
                created_items.append(item)

    await asyncio.gather(*[ingest(f, p) for f, p in zip(files, paths)])

    total = await dataset_repo.count_items(dataset_id)
    size = await item_repo.sum_size(dataset_id)
    await dataset_repo.update(dataset, item_count=total, total_size_bytes=size)

    return {
        "uploaded": len(created_items),
        "skipped": skipped,
        "rejected": rejected,
        "items": [
            {
                "id": str(i.id),
                "filename": i.original_filename,
                "relative_path": i.relative_path,
                "status": getattr(i.status, "value", str(i.status)),
                "file_size_bytes": i.file_size_bytes,
                "duration_seconds": i.duration_seconds,
                "fps": i.fps,
                "width": i.width,
                "height": i.height,
            }
            for i in created_items
        ],
    }


@router.post("/zip/inspect")
async def inspect_zip_upload(
    current_user: CurrentUser,
    db: DB,
    dataset_id: uuid.UUID = Form(...),
    file: UploadFile = File(...),
):
    dataset = await DatasetRepository(db).get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    name = (file.filename or "").lower()
    if not name.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Upload a .zip file")
    payload = await file.read()
    modality = getattr(dataset.modality, "value", str(dataset.modality))
    try:
        _job_id, report = await asyncio.to_thread(save_zip_job, str(dataset_id), payload, modality)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return report


@router.post("/zip/import")
async def import_zip_upload(
    current_user: CurrentUser,
    db: DB,
    dataset_id: uuid.UUID = Form(...),
    job_id: str = Form(...),
):
    dataset = await DatasetRepository(db).get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    try:
        result = await import_zip_job(db, dataset_id, job_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result
