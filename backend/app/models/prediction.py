import uuid
from typing import Optional
from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin

class Prediction(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'predictions'
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('dataset_items.id', ondelete='CASCADE'), nullable=False, index=True)
    model_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('model_versions.id'), nullable=False)
    objects: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    meta: Mapped[Optional[dict]] = mapped_column("metadata", JSONB, default=dict)
