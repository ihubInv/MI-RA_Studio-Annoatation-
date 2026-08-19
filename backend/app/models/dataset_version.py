import uuid
from typing import Optional
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin

class DatasetVersion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'dataset_versions'
    dataset_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('datasets.id', ondelete='CASCADE'), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    tag: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    snapshot_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    changes: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    dataset = relationship('Dataset', back_populates='versions')
