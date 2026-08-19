import uuid, enum
from typing import Optional
from sqlalchemy import Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin

class Assignment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'assignments'
    task_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('tasks.id', ondelete='CASCADE'), nullable=False)
    assignee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=False)
    status: Mapped[str] = mapped_column(String(50), default='pending')
    task = relationship('Task', back_populates='assignments')
    assignee = relationship('User', back_populates='assignments')
