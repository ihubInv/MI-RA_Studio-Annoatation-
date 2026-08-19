"""AnnotationClass — a label class within a schema."""
import uuid
from typing import Optional
from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin


class AnnotationClass(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "annotation_classes"

    schema_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("annotation_schemas.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    tools: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    # Hierarchical parent class
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Hotkey shortcut
    hotkey: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    schema = relationship("AnnotationSchema", back_populates="classes")
    attributes = relationship("AnnotationAttribute", back_populates="annotation_class", cascade="all, delete-orphan")
