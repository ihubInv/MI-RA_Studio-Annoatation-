import uuid
from typing import Optional
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin

class MLModel(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'ml_models'
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    framework: Mapped[str] = mapped_column(String(100), nullable=False)
    input_modality: Mapped[str] = mapped_column(String(100), nullable=False)
    output_schema: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(default=True)
    versions = relationship('ModelVersion', back_populates='model')
