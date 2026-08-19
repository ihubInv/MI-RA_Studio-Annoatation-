"""AnnotationKeypoint — for pose/skeleton annotation."""
import uuid
from typing import Optional
from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin


class AnnotationKeypoint(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "annotation_keypoints"

    object_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("annotation_objects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    x: Mapped[float] = mapped_column(Float, nullable=False)
    y: Mapped[float] = mapped_column(Float, nullable=False)
    z: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    visibility: Mapped[int] = mapped_column(Integer, default=2)  # 0=not labeled, 1=occluded, 2=visible
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    object = relationship("AnnotationObject", back_populates="keypoints")
