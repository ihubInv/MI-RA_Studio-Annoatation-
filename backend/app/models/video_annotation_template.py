"""Custom Video Annotation Templates — stored independently of annotation records.

Classic video annotation does not read these tables. A project or dataset
optionally points at a template; NULL means the existing studio is used.
"""
from __future__ import annotations

import enum
import uuid
from typing import Optional

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin


class VideoTemplateStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class VideoAnnotationTemplate(Base, UUIDMixin, TimestampMixin):
    """Template identity. Configuration lives on version rows."""

    __tablename__ = "video_annotation_templates"

    project_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    published_version: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), default=VideoTemplateStatus.DRAFT.value, nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )

    versions = relationship(
        "VideoAnnotationTemplateVersion",
        back_populates="template",
        cascade="all, delete-orphan",
        order_by="VideoAnnotationTemplateVersion.version",
        foreign_keys="VideoAnnotationTemplateVersion.template_id",
    )


class VideoAnnotationTemplateVersion(Base, UUIDMixin, TimestampMixin):
    """Configuration snapshot. Published rows are immutable; drafts may be updated in place."""

    __tablename__ = "video_annotation_template_versions"
    __table_args__ = (
        UniqueConstraint("template_id", "version", name="uq_video_template_version"),
    )

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("video_annotation_templates.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str] = mapped_column(String(32), default="1.0", nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    tools: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    labels: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    attributes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    timeline: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    ai: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    validation: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    ui: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    export: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    extras: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    template = relationship(
        "VideoAnnotationTemplate",
        back_populates="versions",
        foreign_keys=[template_id],
    )
