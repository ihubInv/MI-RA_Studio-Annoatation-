"""Inference API schemas."""
from typing import Any, Literal

from pydantic import BaseModel, Field

OutputMode = Literal["bbox", "polygon", "mask"]


class DetectedObject(BaseModel):
    class_name: str
    confidence: float
    tool_type: str
    geometry: dict[str, Any]


class DetectResponse(BaseModel):
    engine: str
    model: str
    output: OutputMode
    objects: list[DetectedObject]
    total: int = 0


class ModelInfo(BaseModel):
    id: str
    weights: str = ""
    task: str = "detect"
    label: str = ""


class ModelsListResponse(BaseModel):
    available: bool
    items: list[ModelInfo]
    default_model: str = Field(default="yolov8n")
    default_output: OutputMode = Field(default="bbox")
    segment_models: list[ModelInfo] = Field(default_factory=list)
    pose_models: list[ModelInfo] = Field(default_factory=list)


class SegmentResponse(BaseModel):
    engine: str
    model: str
    points: list[dict[str, float]]


class PoseResponse(BaseModel):
    engine: str
    model: str
    geometry: dict[str, Any] | None


class PrelabelRequest(BaseModel):
    dataset_id: str
    model: str = "yolov8n"
    output: OutputMode = "bbox"
    confidence: float = 0.25
    folder: str | None = None
    skip_existing: bool = True
    limit: int = Field(default=100, ge=1, le=5000)


class PrelabelResponse(BaseModel):
    status: str
    queued: int = 0
    message: str = ""
