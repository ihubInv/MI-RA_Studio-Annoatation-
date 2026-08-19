import uuid
from typing import Optional
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin

class ExportJob(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'export_jobs'
    dataset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('datasets.id'), nullable=False)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    format: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default='pending')
    result_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    config: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    error: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
