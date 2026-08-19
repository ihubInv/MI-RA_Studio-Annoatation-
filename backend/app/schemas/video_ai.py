"""Video AI inference schemas (Phase 16 + 17)."""
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.inference import DetectResponse, DetectedObject, ModelInfo, PoseResponse, SegmentResponse


class VideoAiModelsResponse(BaseModel):
    available: bool
    detect_models: list[ModelInfo] = Field(default_factory=list)
    segment_models: list[ModelInfo] = Field(default_factory=list)
    pose_models: list[ModelInfo] = Field(default_factory=list)
    track_models: list[ModelInfo] = Field(default_factory=list)


class VideoDetectResponse(DetectResponse):
    frame_index: int | None = None


class VideoSegmentResponse(SegmentResponse):
    frame_index: int | None = None


class VideoPoseResponse(PoseResponse):
    frame_index: int | None = None


class TrackSeed(BaseModel):
    track_id: str
    class_name: str = "Object"
    confidence: float = 1.0
    x: float
    y: float
    width: float
    height: float


class TrackFrameDetections(BaseModel):
    frame: int
    objects: list[DetectedObject]


class TrackRequest(BaseModel):
    seeds: list[TrackSeed]
    frames: list[TrackFrameDetections]
    min_track_confidence: float = Field(default=0.25, ge=0.05, le=1.0)
    retain_low_confidence: bool = True
    id_switch_iou_threshold: float = Field(default=0.35, ge=0.05, le=1.0)
    reid_iou_threshold: float = Field(default=0.15, ge=0.05, le=1.0)


TrackKeyframeStatus = Literal["matched", "low_confidence", "id_switch_suspect"]


class TrackKeyframe(BaseModel):
    track_id: str
    class_name: str
    frame: int
    geometry: dict[str, Any]
    confidence: float = 0.0
    track_confidence: float = 0.0
    match_iou: float = 0.0
    status: TrackKeyframeStatus = "matched"
    needs_review: bool = False


class TrackGap(BaseModel):
    track_id: str
    class_name: str = "Object"
    start_frame: int
    end_frame: int
    open: bool = False


class IdSwitchEvent(BaseModel):
    track_id: str
    class_name: str = "Object"
    frame: int
    match_iou: float = 0.0
    track_confidence: float = 0.0
    reason: str | None = None


class ReIdCandidate(BaseModel):
    track_id: str
    class_name: str = "Object"
    frame: int
    reid_score: float = 0.0
    geometry: dict[str, Any]
    predicted: bool = False


class TrackResponse(BaseModel):
    engine: str = "iou"
    model: str = "iou_v1"
    keyframes: list[TrackKeyframe]
    tracks: list[dict[str, Any]] = Field(default_factory=list)
    gaps: list[TrackGap] = Field(default_factory=list)
    id_switches: list[IdSwitchEvent] = Field(default_factory=list)
    reid_candidates: list[ReIdCandidate] = Field(default_factory=list)
