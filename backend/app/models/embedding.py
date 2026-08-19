import uuid
from typing import Optional
from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
try:
    from pgvector.sqlalchemy import Vector
    EMBEDDING_DIM = 512
    has_pgvector = True
except ImportError:
    has_pgvector = False
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin

class Embedding(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'embeddings'
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('dataset_items.id', ondelete='CASCADE'), nullable=False, index=True)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    vector = mapped_column(Vector(512) if has_pgvector else String(1), nullable=True)
    item = relationship('DatasetItem', back_populates='embeddings')
