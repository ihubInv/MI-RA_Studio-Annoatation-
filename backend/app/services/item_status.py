"""Keep dataset item annotation status in sync with the latest annotation."""
from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.annotation import Annotation, AnnotationStatus
from app.models.dataset_item import ItemStatus
from app.repositories.dataset_repo import DatasetItemRepository


def item_status_from_annotation(annotation: Annotation, object_count: int) -> ItemStatus:
    if annotation.status == AnnotationStatus.APPROVED:
        return ItemStatus.APPROVED
    if annotation.status == AnnotationStatus.IN_REVIEW:
        return ItemStatus.IN_REVIEW
    if annotation.status == AnnotationStatus.REJECTED:
        return ItemStatus.REJECTED
    if annotation.status == AnnotationStatus.SUBMITTED:
        return ItemStatus.ANNOTATED
    if object_count > 0:
        return ItemStatus.ANNOTATING
    return ItemStatus.READY


async def sync_item_status(db: AsyncSession, item_id: uuid.UUID, annotation: Annotation, object_count: int) -> None:
    repo = DatasetItemRepository(db)
    item = await repo.get_by_id(item_id)
    if not item:
        return
    next_status = item_status_from_annotation(annotation, object_count)
    if item.status != next_status:
        await repo.update(item, status=next_status)
