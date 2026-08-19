"""DatasetItem ORM model — one media file per row."""
import enum
import uuid
from typing import Optional

from sqlalchemy import BigInteger, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin


class ItemStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    READY = "ready"
    ANNOTATING = "annotating"
    ANNOTATED = "annotated"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    ERROR = "error"


class DatasetItem(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "dataset_items"

    dataset_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    relative_path: Mapped[str] = mapped_column(String(2000), nullable=False, default="", index=True)
    parent_folder: Mapped[str] = mapped_column(String(1500), nullable=False, default="", index=True)
    storage_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    preview_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    status: Mapped[ItemStatus] = mapped_column(
        Enum(ItemStatus), default=ItemStatus.PENDING, nullable=False, index=True
    )
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    duration_seconds: Mapped[Optional[float]] = mapped_column(nullable=True)
    frame_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    fps: Mapped[Optional[float]] = mapped_column(nullable=True)
    # Flexible metadata (EXIF, DICOM tags, GPS coords, CRS, etc.)
    meta: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, default=dict)
    # Tags for search and filtering
    tags: Mapped[Optional[list]] = mapped_column(JSONB, default=list)

    dataset = relationship("Dataset", back_populates="items")
    annotations = relationship("Annotation", back_populates="item", cascade="all, delete-orphan")
    embeddings = relationship("Embedding", back_populates="item")

    def __repr__(self) -> str:
        return f"<DatasetItem {self.filename} ({self.status})>"
