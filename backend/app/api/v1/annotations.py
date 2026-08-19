"""Annotations API — universal CRUD for all modalities."""
import math
import uuid
from typing import List

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DB
from app.models.annotation import Annotation
from app.models.annotation_object import AnnotationObject
from app.repositories.annotation_repo import AnnotationRepository
from app.schemas.annotation import (
    AnnotationCreate,
    AnnotationPreviewsResponse,
    AnnotationRead,
    AnnotationUpdate,
)
from app.schemas.common import MessageResponse, PaginatedResponse
from app.services.audit_service import log_action
from app.services.item_status import sync_item_status

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[AnnotationRead])
async def list_annotations(
    current_user: CurrentUser,
    db: DB,
    item_id: uuid.UUID = Query(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    repo = AnnotationRepository(db)
    items = await repo.list_for_item(item_id)
    total = len(items)
    offset = (page - 1) * page_size
    return PaginatedResponse(
        items=items[offset : offset + page_size],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.post("/", response_model=AnnotationRead, status_code=status.HTTP_201_CREATED)
async def create_annotation(payload: AnnotationCreate, current_user: CurrentUser, db: DB):
    repo = AnnotationRepository(db)
    version = await repo.get_next_version(payload.item_id, current_user.id)
    annotation = Annotation(
        item_id=payload.item_id,
        annotator_id=current_user.id,
        schema_id=payload.schema_id,
        task_id=payload.task_id,
        version=version,
        labels=payload.labels,
        notes=payload.notes,
        meta=payload.metadata,
    )
    annotation = await repo.create(annotation)
    # Create annotation objects
    for obj_data in payload.objects:
        obj = AnnotationObject(
            annotation_id=annotation.id,
            **obj_data.model_dump(exclude_none=True),
        )
        db.add(obj)
    await db.flush()
    result = await repo.get_with_objects(annotation.id)
    await sync_item_status(db, payload.item_id, result, len(result.objects or []))
    await log_action(db, current_user.id, "create_annotation", "annotation", str(annotation.id))
    return result


@router.get("/previews", response_model=AnnotationPreviewsResponse)
async def preview_dataset_annotations(
    current_user: CurrentUser,
    db: DB,
    dataset_id: uuid.UUID = Query(...),
):
    """Latest annotation objects for every item in a dataset, for gallery overlays."""
    repo = AnnotationRepository(db)
    annotations = await repo.list_latest_for_dataset(dataset_id)
    items: dict[str, dict] = {}
    for ann in annotations:
        objects = []
        for obj in ann.objects or []:
            if obj.is_hidden:
                continue
            objects.append(
                {
                    "id": str(obj.id),
                    "class_name": obj.class_name,
                    "tool_type": obj.tool_type,
                    "geometry": obj.geometry or {},
                }
            )
        items[str(ann.item_id)] = {
            "annotation_id": str(ann.id),
            "status": getattr(ann.status, "value", str(ann.status)),
            "object_count": len(objects),
            "objects": objects,
        }
    return {"items": items}


@router.get("/latest", response_model=AnnotationRead)
async def get_latest_annotation(
    current_user: CurrentUser,
    db: DB,
    item_id: uuid.UUID = Query(...),
):
    repo = AnnotationRepository(db)
    annotation = await repo.get_latest_for_item(item_id, current_user.id)
    if not annotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No annotation yet")
    return annotation


@router.get("/{annotation_id}", response_model=AnnotationRead)
async def get_annotation(annotation_id: uuid.UUID, current_user: CurrentUser, db: DB):
    repo = AnnotationRepository(db)
    annotation = await repo.get_with_objects(annotation_id)
    if not annotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found")
    return annotation


@router.patch("/{annotation_id}", response_model=AnnotationRead)
async def update_annotation(
    annotation_id: uuid.UUID, payload: AnnotationUpdate, current_user: CurrentUser, db: DB
):
    repo = AnnotationRepository(db)
    annotation = await repo.get_with_objects(annotation_id)
    if not annotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found")

    updates = payload.model_dump(exclude_none=True, exclude={"objects"})
    if "metadata" in updates:
        updates["meta"] = updates.pop("metadata")
    annotation = await repo.update(annotation, **updates)

    # Replace annotation objects if provided
    if payload.objects is not None:
        for obj in annotation.objects:
            await db.delete(obj)
        await db.flush()
        for obj_data in payload.objects:
            obj = AnnotationObject(annotation_id=annotation.id, **obj_data.model_dump(exclude_none=True))
            db.add(obj)
        await db.flush()

    result = await repo.get_with_objects(annotation.id)
    await sync_item_status(db, annotation.item_id, result, len(result.objects or []))
    await log_action(db, current_user.id, "update_annotation", "annotation", str(annotation_id))
    return result


@router.post("/{annotation_id}/submit", response_model=AnnotationRead)
async def submit_annotation(annotation_id: uuid.UUID, current_user: CurrentUser, db: DB):
    repo = AnnotationRepository(db)
    annotation = await repo.get_with_objects(annotation_id)
    if not annotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found")
    annotation = await repo.update(annotation, status="submitted")
    result = await repo.get_with_objects(annotation.id)
    await sync_item_status(db, annotation.item_id, result, len(result.objects or []))
    await log_action(db, current_user.id, "submit_annotation", "annotation", str(annotation_id))
    return annotation


@router.delete("/{annotation_id}", response_model=MessageResponse)
async def delete_annotation(annotation_id: uuid.UUID, current_user: CurrentUser, db: DB):
    repo = AnnotationRepository(db)
    annotation = await repo.get_by_id(annotation_id)
    if not annotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found")
    await repo.delete(annotation)
    await log_action(db, current_user.id, "delete_annotation", "annotation", str(annotation_id))
    return MessageResponse(message="Annotation deleted")
