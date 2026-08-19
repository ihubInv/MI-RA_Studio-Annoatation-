"""AnnotationAttribute — configurable per-class attributes."""
import uuid
from typing import Optional
from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base
from app.models.base import UUIDMixin


class AnnotationAttribute(Base, UUIDMixin):
    __tablename__ = "annotation_attributes"

    class_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("annotation_classes.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    input_type: Mapped[str] = mapped_column(String(50), nullable=False)  # text, number, boolean, select, multiselect, radio
    values: Mapped[Optional[list]] = mapped_column(JSONB, default=list)   # for select/radio
    default_value: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    is_required: Mapped[bool] = mapped_column(Boolean, default=False)

    annotation_class = relationship("AnnotationClass", back_populates="attributes")
