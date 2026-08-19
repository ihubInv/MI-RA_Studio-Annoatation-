"""Datasets API — full CRUD."""
import math
import uuid

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DB
from app.models.dataset import Dataset
from app.models.dataset_item import DatasetItem, ItemStatus
from app.repositories.dataset_repo import DatasetItemRepository, DatasetRepository
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.dataset import DatasetCreate, DatasetRead, DatasetUpdate, LocalFileBatch, LocalFileMeta
from app.services.audit_service import log_action
from app.services.dataset_paths import filename_of, normalize_relative_path, parent_folder_of

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[DatasetRead])
async def list_datasets(
    current_user: CurrentUser,
    db: DB,
    project_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    repo = DatasetRepository(db)
    offset = (page - 1) * page_size
    if project_id:
        items = await repo.list_for_project(project_id, page_size, offset)
        total = await repo.count(project_id=project_id)
    else:
        items = await repo.list_all(page_size, offset)
        total = await repo.count()
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.post("/", response_model=DatasetRead, status_code=status.HTTP_201_CREATED)
async def create_dataset(payload: DatasetCreate, current_user: CurrentUser, db: DB):
    repo = DatasetRepository(db)
    data = payload.model_dump(exclude={"cloud_uri"})
    data["storage_mode"] = getattr(payload.storage_mode, "value", payload.storage_mode)
    meta = {}
    if payload.cloud_uri:
        meta["cloud_uri"] = payload.cloud_uri
    dataset = Dataset(**data, meta=meta or None)
    dataset = await repo.create(dataset)
    await log_action(db, current_user.id, "create_dataset", "dataset", str(dataset.id))
    return dataset


@router.get("/{dataset_id}", response_model=DatasetRead)
async def get_dataset(dataset_id: uuid.UUID, current_user: CurrentUser, db: DB):
    repo = DatasetRepository(db)
    dataset = await repo.get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return dataset


@router.patch("/{dataset_id}", response_model=DatasetRead)
async def update_dataset(
    dataset_id: uuid.UUID, payload: DatasetUpdate, current_user: CurrentUser, db: DB
):
    repo = DatasetRepository(db)
    dataset = await repo.get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    dataset = await repo.update(dataset, **payload.model_dump(exclude_none=True))
    await log_action(db, current_user.id, "update_dataset", "dataset", str(dataset_id))
    return dataset


@router.delete("/{dataset_id}", response_model=MessageResponse)
async def delete_dataset(dataset_id: uuid.UUID, current_user: CurrentUser, db: DB):
    repo = DatasetRepository(db)
    dataset = await repo.get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    await repo.delete(dataset)
    await log_action(db, current_user.id, "delete_dataset", "dataset", str(dataset_id))
    return MessageResponse(message="Dataset deleted successfully")


@router.get("/{dataset_id}/stats")
async def get_dataset_stats(dataset_id: uuid.UUID, current_user: CurrentUser, db: DB):
    repo = DatasetRepository(db)
    dataset = await repo.get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    item_count = await repo.count_items(dataset_id)
    return {
        "dataset_id": str(dataset_id),
        "item_count": item_count,
        "modality": dataset.modality,
        "total_size_bytes": dataset.total_size_bytes,
        "status": dataset.status,
    }


@router.get("/{dataset_id}/tree")
async def get_dataset_tree(dataset_id: uuid.UUID, current_user: CurrentUser, db: DB):
    repo = DatasetRepository(db)
    dataset = await repo.get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    from app.services.dataset_tree import build_dataset_tree

    payload = await build_dataset_tree(db, dataset_id)
    payload["dataset"] = {
        "id": str(dataset.id),
        "name": dataset.name,
        "modality": getattr(dataset.modality, "value", str(dataset.modality)),
        "status": getattr(dataset.status, "value", str(dataset.status)),
        "storage_mode": dataset.storage_mode or "server",
    }
    return payload


@router.post("/{dataset_id}/local/files")
async def register_local_files(
    dataset_id: uuid.UUID,
    payload: LocalFileBatch,
    current_user: CurrentUser,
    db: DB,
):
    """Index local files as metadata only — original bytes stay on the user's computer."""
    repo = DatasetRepository(db)
    item_repo = DatasetItemRepository(db)
    dataset = await repo.get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    if (dataset.storage_mode or "server") != "local":
        raise HTTPException(status_code=400, detail="Dataset is not in Local Dataset Mode")
    if len(payload.files) > 500:
        raise HTTPException(status_code=413, detail="Send at most 500 file records per request")

    prepared: list[tuple[str, LocalFileMeta]] = []
    for entry in payload.files:
        try:
            rel = normalize_relative_path(entry.relative_path)
        except ValueError:
            continue
        if rel:
            prepared.append((rel, entry))

    existing = await item_repo.existing_relative_paths(dataset_id, [rel for rel, _ in prepared])
    created = 0
    skipped = 0
    items_out = []
    to_insert: list[DatasetItem] = []
    for rel, entry in prepared:
        if rel in existing:
            skipped += 1
            items_out.append({"relative_path": rel, "status": "exists"})
            continue
        existing.add(rel)
        to_insert.append(
            DatasetItem(
                dataset_id=dataset_id,
                filename=entry.filename or filename_of(rel),
                original_filename=entry.filename or filename_of(rel),
                relative_path=rel,
                parent_folder=parent_folder_of(rel),
                storage_path=f"local:{rel}",
                mime_type=entry.mime_type or "application/octet-stream",
                file_size_bytes=entry.file_size_bytes or 0,
                status=ItemStatus.READY,
                width=entry.width,
                height=entry.height,
                meta={"last_modified_ms": entry.last_modified_ms, "source": "local"},
            )
        )
        items_out.append({"relative_path": rel, "status": "created"})
        created += 1

    await item_repo.bulk_create(to_insert)

    if payload.root_name:
        meta = dict(dataset.meta or {})
        meta["root_name"] = payload.root_name
        await repo.update(dataset, meta=meta)

    total = await repo.count_items(dataset_id)
    size = await item_repo.sum_size(dataset_id)
    await repo.update(dataset, item_count=total, total_size_bytes=size)
    await log_action(db, current_user.id, "register_local_files", "dataset", str(dataset_id))
    return {
        "created": created,
        "skipped": skipped,
        "item_count": total,
        "items": items_out,
    }
