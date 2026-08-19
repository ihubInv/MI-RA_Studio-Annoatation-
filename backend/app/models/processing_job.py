import uuid
from typing import Optional
from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin

class ProcessingJob(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'processing_jobs'
    item_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey('dataset_items.id'), nullable=True)
    job_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default='pending')
    progress: Mapped[int] = mapped_column(Integer, default=0)
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    result: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    error: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
