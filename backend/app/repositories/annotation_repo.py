"""Annotation repository."""
import uuid
from typing import Optional, Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.annotation import Annotation
from app.models.annotation_object import AnnotationObject
from app.repositories.base_repo import BaseRepository


class AnnotationRepository(BaseRepository[Annotation]):
    def __init__(self, db: AsyncSession):
        super().__init__(Annotation, db)

    async def get_with_objects(self, annotation_id: uuid.UUID) -> Optional[Annotation]:
        result = await self.db.execute(
            select(Annotation)
            .where(Annotation.id == annotation_id)
            .options(selectinload(Annotation.objects).selectinload(AnnotationObject.keypoints))
        )
        return result.scalar_one_or_none()

    async def list_for_item(
        self,
        item_id: uuid.UUID,
        version: Optional[int] = None,
    ) -> Sequence[Annotation]:
        stmt = (
            select(Annotation)
            .where(Annotation.item_id == item_id)
            .options(selectinload(Annotation.objects))
            .order_by(Annotation.version.desc())
        )
        if version is not None:
            stmt = stmt.where(Annotation.version == version)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_latest_for_item(
        self,
        item_id: uuid.UUID,
        annotator_id: Optional[uuid.UUID] = None,
    ) -> Optional[Annotation]:
        stmt = (
            select(Annotation)
            .where(Annotation.item_id == item_id)
            .options(selectinload(Annotation.objects))
            .order_by(Annotation.version.desc())
            .limit(1)
        )
        if annotator_id:
            stmt = stmt.where(Annotation.annotator_id == annotator_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_next_version(self, item_id: uuid.UUID, annotator_id: uuid.UUID) -> int:
        from sqlalchemy import func
        result = await self.db.execute(
            select(func.max(Annotation.version))
            .where(Annotation.item_id == item_id)
            .where(Annotation.annotator_id == annotator_id)
        )
        max_ver = result.scalar_one_or_none()
        return (max_ver or 0) + 1

    async def list_latest_for_dataset(self, dataset_id: uuid.UUID) -> Sequence[Annotation]:
        from sqlalchemy import desc
        from app.models.dataset_item import DatasetItem

        stmt = (
            select(Annotation)
            .join(DatasetItem, DatasetItem.id == Annotation.item_id)
            .where(DatasetItem.dataset_id == dataset_id)
            .options(selectinload(Annotation.objects))
            .distinct(Annotation.item_id)
            .order_by(Annotation.item_id, desc(Annotation.updated_at), desc(Annotation.version))
        )
        result = await self.db.execute(stmt)
        return result.scalars().unique().all()
