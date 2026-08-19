"""Remaining ORM models (stubs with full structure)."""
# ── Task ─────────────────────────────────────────────────────────
import enum
import uuid
from typing import Optional
from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"


class Task(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tasks"

    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    dataset_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.PENDING, nullable=False, index=True)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    item_ids: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    meta: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, default=dict)

    project = relationship("Project", back_populates="tasks")
    assignments = relationship("Assignment", back_populates="task")
