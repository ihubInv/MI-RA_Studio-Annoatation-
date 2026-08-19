import uuid
from typing import Optional
from sqlalchemy import Float, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin

class QAResult(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'qa_results'
    annotation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('annotations.id', ondelete='CASCADE'), nullable=False)
    qa_type: Mapped[str] = mapped_column(String(50), nullable=False)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    issues: Mapped[Optional[list]] = mapped_column(JSONB, default=list)
    details: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
