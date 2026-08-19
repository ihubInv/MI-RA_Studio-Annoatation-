"""Label / annotation-schema payloads used by the studio."""
import uuid
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class LabelAttributeIn(BaseModel):
    name: str
    input_type: str = "boolean"
    values: Optional[list[str]] = None
    required: bool = False


class LabelClassIn(BaseModel):
    id: str
    name: str
    display_name: Optional[str] = None
    color: str = "#0d559e"
    category: str = "Other"
    parent_id: Optional[str] = None
    hotkey: Optional[str] = None
    annotation_type: Optional[str] = "bbox"
    description: Optional[str] = None
    enabled: bool = True
    attributes: list[LabelAttributeIn] = Field(default_factory=list)


class LabelSchemaBody(BaseModel):
    version: int = 1
    projectKey: str
    classes: list[LabelClassIn]


class AnnotationSchemaRead(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    version: str = "1.0"
    project_id: Optional[uuid.UUID] = None
    dataset_id: Optional[uuid.UUID] = None
    schema_definition: dict[str, Any]
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
