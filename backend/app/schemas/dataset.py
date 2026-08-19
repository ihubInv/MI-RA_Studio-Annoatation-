"""Dataset + DatasetItem Pydantic schemas."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.config import settings
from app.models.dataset import DatasetModality, DatasetStatus, StorageMode
from app.models.dataset_item import ItemStatus


# ── Dataset ───────────────────────────────────────────────────────
class DatasetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    modality: DatasetModality
    project_id: uuid.UUID
    annotation_schema_id: Optional[uuid.UUID] = None
    storage_mode: StorageMode = StorageMode.LOCAL
    cloud_uri: Optional[str] = None


class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    annotation_schema_id: Optional[uuid.UUID] = None


class DatasetRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    modality: DatasetModality
    status: DatasetStatus
    item_count: int
    total_size_bytes: int
    project_id: uuid.UUID
    annotation_schema_id: Optional[uuid.UUID]
    storage_mode: StorageMode = StorageMode.SERVER
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Dataset Item ──────────────────────────────────────────────────
class DatasetItemRead(BaseModel):
    id: uuid.UUID
    dataset_id: uuid.UUID
    filename: str
    original_filename: str
    storage_path: str
    thumbnail_path: Optional[str]
    preview_path: Optional[str]
    mime_type: str
    file_size_bytes: int
    status: ItemStatus
    width: Optional[int]
    height: Optional[int]
    duration_seconds: Optional[float]
    frame_count: Optional[int]
    fps: Optional[float]
    metadata: Optional[Dict[str, Any]] = Field(default=None, validation_alias="meta")
    tags: Optional[List[str]]
    created_at: datetime
    relative_path: str = ""
    parent_folder: str = ""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @computed_field
    @property
    def is_local(self) -> bool:
        return (self.storage_path or "").startswith("local:")

    @computed_field
    @property
    def media_url(self) -> Optional[str]:
        if not self.storage_path or self.storage_path.startswith("local:"):
            return None
        return f"{settings.STORAGE_BASE_URL.rstrip('/')}/{self.storage_path.lstrip('/')}"

    @computed_field
    @property
    def thumbnail_url(self) -> Optional[str]:
        if not self.thumbnail_path or (self.storage_path or "").startswith("local:"):
            return None
        return f"{settings.STORAGE_BASE_URL.rstrip('/')}/{self.thumbnail_path.lstrip('/')}"


class DatasetItemUpdate(BaseModel):
    status: Optional[ItemStatus] = None
    tags: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None


class LocalFileMeta(BaseModel):
    relative_path: str
    filename: str
    mime_type: str = "application/octet-stream"
    file_size_bytes: int = 0
    last_modified_ms: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None


class LocalFileBatch(BaseModel):
    files: List[LocalFileMeta]
    root_name: Optional[str] = None
