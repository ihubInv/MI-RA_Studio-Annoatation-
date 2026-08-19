"""Dataset ORM model."""
import enum
import uuid
from typing import Optional

from sqlalchemy import BigInteger, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin


class DatasetModality(str, enum.Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    TEXT = "text"
    DOCUMENT = "document"
    POSE_2D = "pose_2d"
    POSE_3D = "pose_3d"
    LIDAR = "lidar"
    POINT_CLOUD = "point_cloud"
    DEPTH = "depth"
    MEDICAL = "medical"
    GEOSPATIAL = "geospatial"
    TIME_SERIES = "time_series"
    MULTIMODAL = "multimodal"
    OTHER = "other"


class DatasetStatus(str, enum.Enum):
    UPLOADING = "uploading"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


class StorageMode(str, enum.Enum):
    LOCAL = "local"
    CLOUD = "cloud"
    SERVER = "server"


class Dataset(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "datasets"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    modality: Mapped[DatasetModality] = mapped_column(
        Enum(DatasetModality), nullable=False, index=True
    )
    status: Mapped[DatasetStatus] = mapped_column(
        Enum(DatasetStatus), default=DatasetStatus.READY, nullable=False
    )
    item_count: Mapped[int] = mapped_column(Integer, default=0)
    total_size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    storage_mode: Mapped[str] = mapped_column(String(20), default="local", nullable=False, index=True)
    storage_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    meta: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, default=dict)

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    annotation_schema_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("annotation_schemas.id"), nullable=True
    )

    project = relationship("Project", back_populates="datasets")
    items = relationship("DatasetItem", back_populates="dataset", cascade="all, delete-orphan")
    versions = relationship("DatasetVersion", back_populates="dataset")
    annotation_schema = relationship("AnnotationSchema", back_populates="datasets")

    def __repr__(self) -> str:
        return f"<Dataset {self.name} ({self.modality})>"
