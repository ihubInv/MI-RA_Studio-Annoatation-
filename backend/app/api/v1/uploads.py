"""File upload API — images, folders, and ZIP datasets."""
import asyncio
import json
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.api.deps import CurrentUser, DB
from app.models.dataset_item import DatasetItem
from app.repositories.dataset_repo import DatasetItemRepository, DatasetRepository
from app.services.dataset_ingest import ingest_image_bytes, import_zip_job, save_zip_job
from app.services.dataset_paths import is_image_name, normalize_relative_path

router = APIRouter()

MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024
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

    paths = _parse_relative_paths(relative_paths, files)
    item_repo = DatasetItemRepository(db)
    sem = asyncio.Semaphore(INGEST_CONCURRENCY)
    created_items: list[DatasetItem] = []
    skipped = 0
    lock = asyncio.Lock()

    async def ingest(file: UploadFile, raw_path: str) -> None:
        nonlocal skipped
        async with sem:
            try:
                rel = normalize_relative_path(raw_path) or normalize_relative_path(file.filename or "")
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            if not rel:
                return
            if not is_image_name(rel):
                async with lock:
                    skipped += 1
                return
            content = await file.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=413, detail=f"File {file.filename} exceeds 5GB limit")
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
        "items": [
            {
                "id": str(i.id),
                "filename": i.original_filename,
                "relative_path": i.relative_path,
                "status": getattr(i.status, "value", str(i.status)),
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
    try:
        _job_id, report = await asyncio.to_thread(save_zip_job, str(dataset_id), payload)
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
