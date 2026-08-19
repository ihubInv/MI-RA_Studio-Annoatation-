"""Annotation Pydantic schemas — universal, modality-agnostic."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.annotation import AnnotationStatus


# ── Annotation Object ─────────────────────────────────────────────
class AnnotationObjectCreate(BaseModel):
    id: Optional[uuid.UUID] = None
    class_name: str
    class_id: Optional[uuid.UUID] = None
    tool_type: str
    geometry: Dict[str, Any]
    attributes: Optional[Dict[str, Any]] = None
    hierarchical_labels: Optional[List[str]] = None
    extra_labels: Optional[List[str]] = None
    frame_index: Optional[int] = None
    is_keyframe: Optional[bool] = None
    confidence: Optional[float] = None
    is_locked: Optional[bool] = False
    is_hidden: Optional[bool] = False
    linked_object_id: Optional[uuid.UUID] = None
    link_relation: Optional[str] = None
    comment: Optional[str] = None


class AnnotationObjectRead(AnnotationObjectCreate):
    id: uuid.UUID
    annotation_id: uuid.UUID
    track_id: Optional[uuid.UUID]
    is_locked: bool
    is_hidden: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Keypoint ──────────────────────────────────────────────────────
class KeypointCreate(BaseModel):
    name: str
    index: int
    x: float
    y: float
    z: Optional[float] = None
    visibility: int = 2
    confidence: Optional[float] = None


# ── Annotation ────────────────────────────────────────────────────
class AnnotationCreate(BaseModel):
    item_id: uuid.UUID
    task_id: Optional[uuid.UUID] = None
    schema_id: Optional[uuid.UUID] = None
    labels: Optional[List[str]] = None
    notes: Optional[str] = None
    objects: List[AnnotationObjectCreate] = []
    metadata: Optional[Dict[str, Any]] = None


class AnnotationUpdate(BaseModel):
    status: Optional[AnnotationStatus] = None
    labels: Optional[List[str]] = None
    notes: Optional[str] = None
    objects: Optional[List[AnnotationObjectCreate]] = None
    metadata: Optional[Dict[str, Any]] = None
    duration_seconds: Optional[float] = None


class AnnotationRead(BaseModel):
    id: uuid.UUID
    item_id: uuid.UUID
    annotator_id: uuid.UUID
    schema_id: Optional[uuid.UUID]
    task_id: Optional[uuid.UUID]
    version: int
    status: AnnotationStatus
    is_ground_truth: bool
    duration_seconds: Optional[float]
    notes: Optional[str]
    labels: Optional[List[str]]
    objects: List[AnnotationObjectRead]
    metadata: Optional[Dict[str, Any]] = Field(default=None, validation_alias="meta")
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class AnnotationPreviewObject(BaseModel):
    id: str
    class_name: str
    tool_type: str
    geometry: Dict[str, Any]


class AnnotationPreviewItem(BaseModel):
    annotation_id: str
    status: str
    object_count: int
    objects: List[AnnotationPreviewObject]


class AnnotationPreviewsResponse(BaseModel):
    items: Dict[str, AnnotationPreviewItem]
