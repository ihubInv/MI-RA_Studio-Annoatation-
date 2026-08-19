"""
AnnotationObject — a single labeled shape within an Annotation.
Supports ALL modalities through JSONB geometry and attributes.
"""
import uuid
from typing import Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin


class AnnotationObject(Base, UUIDMixin, TimestampMixin):
    """
    One annotated object (shape, segment, span, entity, etc.).

    geometry examples by tool_type:
      bbox:        {"x": 10, "y": 20, "w": 100, "h": 80}
      polygon:     {"points": [[x,y], ...]}
      keypoint:    {"x": 50, "y": 60, "visibility": 2}
      mask:        {"rle": "...", "width": 640, "height": 480}
      bbox3d:      {"x":0,"y":0,"z":0,"l":3,"w":2,"h":1.5,"yaw":0.2}
      span:        {"start": 10, "end": 25}
      segment:     {"start_sec": 1.2, "end_sec": 4.5}
      geopolygon:  {"crs": "EPSG:4326", "points": [[lon,lat], ...]}
    """
    __tablename__ = "annotation_objects"

    annotation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("annotations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    track_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("annotation_tracks.id"), nullable=True
    )
    # Class / label
    class_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    class_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Tool that produced this object
    tool_type: Mapped[str] = mapped_column(String(100), nullable=False)
    # Geometry stored as flexible JSONB
    geometry: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # Flexible per-object attributes (color, occlusion, etc.)
    attributes: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    # Hierarchical labels (can be a list of label paths)
    hierarchical_labels: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    # Multi-label support
    extra_labels: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    # For video: which frame
    frame_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # Keyframe flag for interpolation
    is_keyframe: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    # Confidence score (AI pre-annotation)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # Lock / visibility flags
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    # Linked object (for relationships between objects)
    linked_object_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    link_relation: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # Comment / note on this object
    comment: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    annotation = relationship("Annotation", back_populates="objects")
    track = relationship("AnnotationTrack", back_populates="objects")
    keypoints = relationship("AnnotationKeypoint", back_populates="object", cascade="all, delete-orphan")
