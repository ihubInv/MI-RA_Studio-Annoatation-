import uuid
from typing import Optional
from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database.connection import Base
from app.models.base import TimestampMixin, UUIDMixin

class Ontology(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'ontologies'
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    version: Mapped[str] = mapped_column(String(20), default='1.0')
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey('organizations.id'), nullable=True)
    entries = relationship('OntologyEntry', back_populates='ontology', cascade='all, delete-orphan')

class OntologyEntry(Base, UUIDMixin, TimestampMixin):
    __tablename__ = 'ontology_entries'
    ontology_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('ontologies.id', ondelete='CASCADE'), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    uri: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    parent_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    properties: Mapped[Optional[dict]] = mapped_column(JSONB, default=dict)
    ontology = relationship('Ontology', back_populates='entries')
