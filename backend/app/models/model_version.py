import uuid
from typing import Optional
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin

class ModelVersion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'model_versions'
    model_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('ml_models.id', ondelete='CASCADE'), nullable=False)
    version_tag: Mapped[str] = mapped_column(String(50), nullable=False)
    weights_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    config: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    model = relationship('MLModel', back_populates='versions')
