"""Task Pydantic schemas."""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field

from app.models.task import TaskStatus


class TaskCreate(BaseModel):
    name: str
    description: Optional[str] = None
    project_id: uuid.UUID
    dataset_id: Optional[uuid.UUID] = None
    priority: int = 0
    item_ids: Optional[List[uuid.UUID]] = None
    metadata: Optional[Dict[str, Any]] = None


class TaskUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[int] = None
    metadata: Optional[Dict[str, Any]] = None


class TaskRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    dataset_id: Optional[uuid.UUID]
    name: str
    description: Optional[str]
    status: TaskStatus
    priority: int
    item_ids: Optional[List[uuid.UUID]]
    metadata: Optional[Dict[str, Any]] = Field(default=None, validation_alias="meta")
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class AssignmentCreate(BaseModel):
    task_id: uuid.UUID
    assignee_id: uuid.UUID


class AssignmentRead(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    assignee_id: uuid.UUID
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
