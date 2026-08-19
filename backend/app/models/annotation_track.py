"""AnnotationTrack — links objects across video/audio frames."""
import uuid
from typing import Optional
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin


class AnnotationTrack(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "annotation_tracks"

    annotation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("annotations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    track_label: Mapped[str] = mapped_column(String(255), nullable=False)
    class_name: Mapped[str] = mapped_column(String(255), nullable=False)
    attributes: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)

    annotation = relationship("Annotation", back_populates="tracks")
    objects = relationship("AnnotationObject", back_populates="track")
