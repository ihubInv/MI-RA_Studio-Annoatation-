"""Core Annotation ORM model — the universal annotation record."""
import enum
import uuid
from typing import Optional

from sqlalchemy import Boolean, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin


class AnnotationStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    CONSENSUS = "consensus"


class Annotation(Base, UUIDMixin, TimestampMixin):
    """
    Top-level annotation record tying together:
    - the dataset item being annotated
    - the annotator
    - the schema used
    - version number (for history/audit)
    - status in the review workflow
    """
    __tablename__ = "annotations"

    item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dataset_items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    annotator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    schema_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("annotation_schemas.id"), nullable=True
    )
    task_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("tasks.id"), nullable=True
    )
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[AnnotationStatus] = mapped_column(
        Enum(AnnotationStatus), default=AnnotationStatus.DRAFT, nullable=False, index=True
    )
    is_ground_truth: Mapped[bool] = mapped_column(Boolean, default=False)
    duration_seconds: Mapped[Optional[float]] = mapped_column(nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Image-level / file-level classification labels
    labels: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    meta: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, default=dict)

    item = relationship("DatasetItem", back_populates="annotations")
    annotator = relationship("User", back_populates="annotations")
    objects = relationship("AnnotationObject", back_populates="annotation", cascade="all, delete-orphan")
    tracks = relationship("AnnotationTrack", back_populates="annotation", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="annotation")

    def __repr__(self) -> str:
        return f"<Annotation item={self.item_id} v{self.version} ({self.status})>"
