"""AnnotationSchema — configurable, no-code schema for a project."""
import uuid
from typing import Optional
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin


class AnnotationSchema(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "annotation_schemas"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[str] = mapped_column(String(20), default="1.0")
    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True
    )
    # Full schema definition stored as JSONB
    schema_definition: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # Validation rules
    validation_rules: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    # Supported modalities
    modalities: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    is_template: Mapped[bool] = mapped_column(default=False)

    classes = relationship("AnnotationClass", back_populates="schema", cascade="all, delete-orphan")
    datasets = relationship("Dataset", back_populates="annotation_schema")
