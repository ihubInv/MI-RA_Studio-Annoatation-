"""Dataset item API — list, browse by folder, bulk actions, delete."""
import math
import uuid

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DB
from app.models.annotation import Annotation
from app.models.dataset_item import ItemStatus
from app.repositories.dataset_repo import DatasetItemRepository, DatasetRepository
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.dataset import DatasetItemRead, DatasetItemUpdate
from app.services.audit_service import log_action
from app.services.storage_service import StorageService

router = APIRouter()


class BulkItemAction(BaseModel):
    dataset_id: uuid.UUID
    action: str
    folder: str | None = None
    recursive: bool = True
    item_ids: list[uuid.UUID] | None = None
    status: str | None = None


@router.get("/", response_model=PaginatedResponse[DatasetItemRead])
async def list_dataset_items(
    current_user: CurrentUser,
    db: DB,
    dataset_id: uuid.UUID = Query(...),
    status_filter: str | None = Query(None, alias="status"),
    folder: str | None = Query(None),
    recursive: bool = Query(True),
    search: str | None = Query(None),
    sort: str = Query("path"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
):
    repo = DatasetItemRepository(db)
    offset = (page - 1) * page_size
    items = await repo.list_for_dataset(
        dataset_id,
        status=status_filter,
        limit=page_size,
        offset=offset,
        folder=folder,
        recursive=recursive,
        search=search,
        sort=sort,
    )
    total = await repo.count_for_dataset(
        dataset_id,
        status=status_filter,
        folder=folder,
        recursive=recursive,
        search=search,
    )
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size) if total else 1),
    )


@router.get("/index")
async def dataset_item_index(
    current_user: CurrentUser,
    db: DB,
    dataset_id: uuid.UUID = Query(...),
    folder: str | None = Query(None),
    recursive: bool = Query(True),
    status_filter: str | None = Query(None, alias="status"),
    search: str | None = Query(None),
):
    repo = DatasetItemRepository(db)
    items = await repo.list_index(
        dataset_id,
        folder=folder,
        recursive=recursive,
        status=status_filter,
        search=search,
        limit=20_000,
    )
    return {
        "items": [
            {
                "id": str(item.id),
                "filename": item.original_filename or item.filename,
                "relative_path": item.relative_path or item.original_filename,
                "parent_folder": item.parent_folder or "",
                "status": getattr(item.status, "value", str(item.status)),
                "file_size_bytes": item.file_size_bytes or 0,
            }
            for item in items
        ]
    }


@router.post("/bulk")
async def bulk_dataset_items(payload: BulkItemAction, current_user: CurrentUser, db: DB):
    repo = DatasetItemRepository(db)
    dataset_repo = DatasetRepository(db)
    ids = await repo.list_ids_in_folder(
        payload.dataset_id,
        folder=payload.folder,
        recursive=payload.recursive,
        item_ids=payload.item_ids,
    )
    if not ids:
        return {"updated": 0}

    if payload.action == "set_status":
        if not payload.status:
            raise HTTPException(status_code=400, detail="status is required")
        try:
            next_status = ItemStatus(payload.status)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid status") from exc
        items = await repo.list_index(payload.dataset_id, folder=payload.folder, recursive=payload.recursive, limit=20_000)
        wanted = set(ids)
        count = 0
        for item in items:
            if item.id in wanted:
                await repo.update(item, status=next_status)
                count += 1
        return {"updated": count}

    if payload.action == "delete_annotations":
        result = await db.execute(select(Annotation).where(Annotation.item_id.in_(ids)))
        anns = result.scalars().all()
        for ann in anns:
            await db.delete(ann)
        items = await repo.list_index(payload.dataset_id, folder=payload.folder, recursive=payload.recursive, limit=20_000)
        wanted = set(ids)
        for item in items:
            if item.id in wanted:
                await repo.update(item, status=ItemStatus.READY)
        await db.flush()
        return {"updated": len(anns)}

    if payload.action == "delete_items":
        storage = StorageService()
        items = await repo.list_index(payload.dataset_id, folder=payload.folder, recursive=payload.recursive, limit=20_000)
        wanted = set(ids)
        deleted = 0
        for item in items:
            if item.id not in wanted:
                continue
            try:
                storage.delete_object(item.storage_path)
                if item.thumbnail_path:
                    storage.delete_object(item.thumbnail_path)
            except Exception:
                pass
            await repo.delete(item)
            deleted += 1
        dataset = await dataset_repo.get_by_id(payload.dataset_id)
        if dataset:
            total = await dataset_repo.count_items(payload.dataset_id)
            size = await repo.sum_size(payload.dataset_id)
            await dataset_repo.update(dataset, item_count=total, total_size_bytes=size)
        return {"updated": deleted}

    raise HTTPException(status_code=400, detail="Unknown bulk action")


@router.get("/{item_id}", response_model=DatasetItemRead)
async def get_dataset_item(item_id: uuid.UUID, current_user: CurrentUser, db: DB):
    repo = DatasetItemRepository(db)
    item = await repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset item not found")
    return item


@router.patch("/{item_id}", response_model=DatasetItemRead)
async def update_dataset_item(
    item_id: uuid.UUID, payload: DatasetItemUpdate, current_user: CurrentUser, db: DB
):
    repo = DatasetItemRepository(db)
    item = await repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset item not found")
    data = payload.model_dump(exclude_none=True)
    if "metadata" in data:
        data["meta"] = data.pop("metadata")
    item = await repo.update(item, **data)
    return item


@router.delete("/{item_id}", response_model=MessageResponse)
async def delete_dataset_item(item_id: uuid.UUID, current_user: CurrentUser, db: DB):
    repo = DatasetItemRepository(db)
    dataset_repo = DatasetRepository(db)
    item = await repo.get_by_id(item_id)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset item not found")

    dataset_id = item.dataset_id
    storage = StorageService()
    try:
        storage.delete_object(item.storage_path)
        if item.thumbnail_path:
            storage.delete_object(item.thumbnail_path)
    except Exception:
        pass

    await repo.delete(item)
    dataset = await dataset_repo.get_by_id(dataset_id)
    if dataset:
        total = await dataset_repo.count_items(dataset_id)
        size = await repo.sum_size(dataset_id)
        await dataset_repo.update(dataset, item_count=total, total_size_bytes=size)
    await log_action(db, current_user.id, "delete_dataset_item", "dataset_item", str(item_id))
    return MessageResponse(message="Dataset item deleted")
