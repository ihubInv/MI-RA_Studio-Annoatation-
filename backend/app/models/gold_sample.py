import uuid
from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin

class GoldSample(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'gold_samples'
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('dataset_items.id'), nullable=False)
    annotation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('annotations.id'), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
