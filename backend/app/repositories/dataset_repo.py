"""Dataset repository."""
import uuid
from typing import Optional, Sequence

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dataset import Dataset
from app.models.dataset_item import DatasetItem, ItemStatus
from app.repositories.base_repo import BaseRepository


class DatasetRepository(BaseRepository[Dataset]):
    def __init__(self, db: AsyncSession):
        super().__init__(Dataset, db)

    async def list_for_project(
        self,
        project_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[Dataset]:
        result = await self.db.execute(
            select(Dataset)
            .where(Dataset.project_id == project_id)
            .order_by(Dataset.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    async def list_all(self, limit: int = 50, offset: int = 0) -> Sequence[Dataset]:
        result = await self.db.execute(
            select(Dataset).order_by(Dataset.created_at.desc()).limit(limit).offset(offset)
        )
        return result.scalars().all()

    async def count_items(self, dataset_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(DatasetItem).where(DatasetItem.dataset_id == dataset_id)
        )
        return result.scalar_one()


class DatasetItemRepository(BaseRepository[DatasetItem]):
    def __init__(self, db: AsyncSession):
        super().__init__(DatasetItem, db)

    async def list_for_dataset(
        self,
        dataset_id: uuid.UUID,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        folder: Optional[str] = None,
        recursive: bool = True,
        search: Optional[str] = None,
        sort: str = "path",
    ) -> Sequence[DatasetItem]:
        stmt = select(DatasetItem).where(DatasetItem.dataset_id == dataset_id)
        stmt = self._apply_filters(stmt, status=status, folder=folder, recursive=recursive, search=search)
        stmt = self._apply_sort(stmt, sort).limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def count_for_dataset(
        self,
        dataset_id: uuid.UUID,
        status: Optional[str] = None,
        folder: Optional[str] = None,
        recursive: bool = True,
        search: Optional[str] = None,
    ) -> int:
        stmt = select(func.count()).select_from(DatasetItem).where(DatasetItem.dataset_id == dataset_id)
        stmt = self._apply_filters(stmt, status=status, folder=folder, recursive=recursive, search=search)
        result = await self.db.execute(stmt)
        return result.scalar_one()

    async def list_index(
        self,
        dataset_id: uuid.UUID,
        folder: Optional[str] = None,
        recursive: bool = True,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 5000,
    ) -> Sequence[DatasetItem]:
        stmt = (
            select(DatasetItem)
            .where(DatasetItem.dataset_id == dataset_id)
        )
        stmt = self._apply_filters(stmt, status=status, folder=folder, recursive=recursive, search=search)
        stmt = self._apply_sort(stmt, "path").limit(limit)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_relative_path(self, dataset_id: uuid.UUID, relative_path: str) -> Optional[DatasetItem]:
        result = await self.db.execute(
            select(DatasetItem)
            .where(DatasetItem.dataset_id == dataset_id)
            .where(DatasetItem.relative_path == relative_path)
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def existing_relative_paths(self, dataset_id: uuid.UUID, paths: Sequence[str]) -> set[str]:
        if not paths:
            return set()
        result = await self.db.execute(
            select(DatasetItem.relative_path)
            .where(DatasetItem.dataset_id == dataset_id)
            .where(DatasetItem.relative_path.in_(paths))
        )
        return set(result.scalars().all())

    async def bulk_create(self, items: list[DatasetItem]) -> None:
        if not items:
            return
        self.db.add_all(items)
        await self.db.flush()

    async def sum_size(self, dataset_id: uuid.UUID) -> int:
        result = await self.db.execute(
            select(func.coalesce(func.sum(DatasetItem.file_size_bytes), 0)).where(
                DatasetItem.dataset_id == dataset_id
            )
        )
        return int(result.scalar_one() or 0)

    async def list_ids_in_folder(
        self,
        dataset_id: uuid.UUID,
        folder: Optional[str],
        recursive: bool = True,
        item_ids: Optional[list[uuid.UUID]] = None,
    ) -> Sequence[uuid.UUID]:
        stmt = select(DatasetItem.id).where(DatasetItem.dataset_id == dataset_id)
        stmt = self._apply_filters(stmt, folder=folder, recursive=recursive)
        if item_ids:
            stmt = stmt.where(DatasetItem.id.in_(item_ids))
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def folder_status_rows(self, dataset_id: uuid.UUID) -> Sequence[tuple]:
        result = await self.db.execute(
            select(DatasetItem.parent_folder, DatasetItem.status, func.count())
            .where(DatasetItem.dataset_id == dataset_id)
            .group_by(DatasetItem.parent_folder, DatasetItem.status)
        )
        return result.all()

    def _apply_filters(self, stmt, status=None, folder=None, recursive: bool = True, search=None):
        if status:
            try:
                stmt = stmt.where(DatasetItem.status == ItemStatus(status))
            except ValueError:
                stmt = stmt.where(DatasetItem.status == status)
        if folder is not None:
            folder = folder.strip("/")
            if recursive:
                if folder:
                    stmt = stmt.where(
                        or_(
                            DatasetItem.parent_folder == folder,
                            DatasetItem.parent_folder.startswith(folder + "/"),
                        )
                    )
            else:
                stmt = stmt.where(DatasetItem.parent_folder == folder)
        if search:
            like = f"%{search}%"
            stmt = stmt.where(
                or_(
                    DatasetItem.original_filename.ilike(like),
                    DatasetItem.relative_path.ilike(like),
                    DatasetItem.filename.ilike(like),
                )
            )
        return stmt

    def _apply_sort(self, stmt, sort: str):
        if sort == "name":
            return stmt.order_by(DatasetItem.original_filename.asc())
        if sort == "date":
            return stmt.order_by(DatasetItem.created_at.desc())
        if sort == "status":
            return stmt.order_by(DatasetItem.status.asc(), DatasetItem.relative_path.asc())
        return stmt.order_by(DatasetItem.relative_path.asc(), DatasetItem.created_at.asc())
