"""Video AI inference API — detect, segment, pose, track (Phase 16)."""
from __future__ import annotations

import json
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.api.deps import CurrentUser
from app.api.v1.inference import _ml_ready, _read_upload, _require_ml
from app.schemas.inference import DetectedObject, ModelInfo
from app.schemas.video_ai import (
    IdSwitchEvent,
    ReIdCandidate,
    TrackGap,
    TrackRequest,
    TrackResponse,
    TrackKeyframe,
    VideoAiModelsResponse,
    VideoDetectResponse,
    VideoPoseResponse,
    VideoSegmentResponse,
)
from app.services.inference_loader import detection_module, pose_module, segmentation_module, tracking_module

router = APIRouter(prefix="/{item_id}/ai", tags=["Video · AI"])


@router.get("/models", response_model=VideoAiModelsResponse)
async def list_video_ai_models(item_id: uuid.UUID, _user: CurrentUser):
    _ = item_id
    available = _ml_ready()
    detect: list[ModelInfo] = []
    segment: list[ModelInfo] = []
    pose: list[ModelInfo] = []
    track: list[ModelInfo] = []
    if available:
        try:
            detect = [ModelInfo(**m) for m in detection_module().list_models()]
        except Exception:
            pass
        try:
            segment = [ModelInfo(**m) for m in segmentation_module().list_models()]
        except Exception:
            pass
        try:
            pose = [ModelInfo(**m) for m in pose_module().list_models()]
        except Exception:
            pass
    try:
        track = [ModelInfo(**m) for m in tracking_module().list_models()]
    except Exception:
        pass
    return VideoAiModelsResponse(
        available=available,
        detect_models=detect,
        segment_models=segment,
        pose_models=pose,
        track_models=track,
    )


@router.post("/detect", response_model=VideoDetectResponse)
async def video_detect(
    item_id: uuid.UUID,
    _user: CurrentUser,
    file: UploadFile = File(...),
    frame_index: int = Form(default=0),
    output: str = Form(default="bbox"),
    model: str = Form(default="yolov8n"),
    confidence: float = Form(default=0.25),
    classes: str = Form(default=""),
):
    _ = item_id
    if output not in ("bbox", "polygon", "mask"):
        raise HTTPException(status_code=400, detail="output must be bbox, polygon, or mask")
    mod = _require_ml(detection_module, "Detection")
    raw = await _read_upload(file)
    class_list = [c.strip() for c in classes.split(",") if c.strip()] or None
    try:
        result = mod.detect_objects(
            raw,
            model_id=model,
            output=output,
            confidence=confidence,
            classes=class_list,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Detection failed: {exc}") from exc
    objects = [DetectedObject(**o) for o in result.get("objects", [])]
    return VideoDetectResponse(
        engine=result.get("engine", "yolo"),
        model=result.get("model", model),
        output=result.get("output", output),
        objects=objects,
        total=len(objects),
        frame_index=frame_index,
    )


@router.post("/segment", response_model=VideoSegmentResponse)
async def video_segment(
    item_id: uuid.UUID,
    _user: CurrentUser,
    file: UploadFile = File(...),
    frame_index: int = Form(default=0),
    points: str = Form(...),
    model: str = Form(default="mobile_sam"),
):
    _ = item_id
    mod = _require_ml(segmentation_module, "SAM segmentation")
    raw = await _read_upload(file)
    try:
        parsed = json.loads(points)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="points must be valid JSON") from exc
    positive = [p for p in parsed if int(p.get("label", 1)) == 1]
    negative = [p for p in parsed if int(p.get("label", 1)) == 0]
    if not positive:
        raise HTTPException(status_code=400, detail="At least one foreground point required")
    try:
        result = mod.segment_with_prompts(raw, positive, negative, model_id=model)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {exc}") from exc
    return VideoSegmentResponse(
        engine=result.get("engine", "sam"),
        model=result.get("model", model),
        points=result.get("points", []),
        frame_index=frame_index,
    )


@router.post("/pose", response_model=VideoPoseResponse)
async def video_pose(
    item_id: uuid.UUID,
    _user: CurrentUser,
    file: UploadFile = File(...),
    frame_index: int = Form(default=0),
    x: float = Form(default=0),
    y: float = Form(default=0),
    model: str = Form(default="yolov8n-pose"),
    confidence: float = Form(default=0.25),
):
    _ = item_id
    mod = _require_ml(pose_module, "Pose estimation")
    raw = await _read_upload(file)
    point = {"x": x, "y": y} if x or y else None
    try:
        result = mod.estimate_pose(raw, point, model_id=model, confidence=confidence)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Pose estimation failed: {exc}") from exc
    return VideoPoseResponse(
        engine=result.get("engine", "yolo-pose"),
        model=result.get("model", model),
        geometry=result.get("geometry"),
        frame_index=frame_index,
    )


@router.post("/track", response_model=TrackResponse)
async def video_track(item_id: uuid.UUID, payload: TrackRequest, _user: CurrentUser):
    _ = item_id
    mod = tracking_module()
    if not mod.ml_available():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Tracker unavailable")
    seeds = [
        {
            "track_id": s.track_id,
            "class_name": s.class_name,
            "confidence": s.confidence,
            "geometry": {"x": s.x, "y": s.y, "width": s.width, "height": s.height},
        }
        for s in payload.seeds
    ]
    frames = [{"frame": f.frame, "objects": [o.model_dump() for o in f.objects]} for f in payload.frames]
    try:
        result = mod.propagate_tracks(
            seeds=seeds,
            frames=frames,
            min_track_confidence=payload.min_track_confidence,
            retain_low_confidence=payload.retain_low_confidence,
            id_switch_iou_threshold=payload.id_switch_iou_threshold,
            reid_iou_threshold=payload.reid_iou_threshold,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Tracking failed: {exc}") from exc
    keyframes = [TrackKeyframe(**kf) for kf in result.get("keyframes", [])]
    gaps = [TrackGap(**g) for g in result.get("gaps", [])]
    id_switches = [IdSwitchEvent(**s) for s in result.get("id_switches", [])]
    reid_candidates = [ReIdCandidate(**c) for c in result.get("reid_candidates", [])]
    return TrackResponse(
        engine=result.get("engine", "iou"),
        model=result.get("model", "iou_v1"),
        keyframes=keyframes,
        tracks=result.get("tracks", []),
        gaps=gaps,
        id_switches=id_switches,
        reid_candidates=reid_candidates,
    )
