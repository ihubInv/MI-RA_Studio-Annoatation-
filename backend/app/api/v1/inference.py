"""Inference API — pretrained detection, segmentation, pose, batch pre-label."""
import json

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.api.deps import CurrentUser
from app.schemas.inference import (
    DetectResponse,
    DetectedObject,
    ModelsListResponse,
    ModelInfo,
    PoseResponse,
    PrelabelRequest,
    PrelabelResponse,
    SegmentResponse,
)
from app.services.inference_loader import detection_module, pose_module, segmentation_module

router = APIRouter()


def _ml_ready() -> bool:
    try:
        mod = detection_module()
        return bool(mod.ml_available())
    except Exception:
        return False


@router.get("/models", response_model=ModelsListResponse)
async def list_inference_models(_user: CurrentUser):
    available = _ml_ready()
    detect_items: list[ModelInfo] = []
    segment_items: list[ModelInfo] = []
    pose_items: list[ModelInfo] = []
    if available:
        try:
            detect_items = [ModelInfo(**m) for m in detection_module().list_models()]
        except Exception:
            pass
        try:
            segment_items = [ModelInfo(**m) for m in segmentation_module().list_models()]
        except Exception:
            pass
        try:
            pose_items = [ModelInfo(**m) for m in pose_module().list_models()]
        except Exception:
            pass
    return ModelsListResponse(
        available=available,
        items=detect_items,
        segment_models=segment_items,
        pose_models=pose_items,
    )


@router.post("/detect", response_model=DetectResponse)
async def detect_in_image(
    _user: CurrentUser,
    file: UploadFile = File(...),
    output: str = Form(default="bbox"),
    model: str = Form(default="yolov8n"),
    confidence: float = Form(default=0.25),
    classes: str = Form(default=""),
):
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
    return DetectResponse(
        engine=result.get("engine", "yolo"),
        model=result.get("model", model),
        output=result.get("output", output),
        objects=objects,
        total=len(objects),
    )


@router.post("/segment", response_model=SegmentResponse)
async def segment_in_image(
    _user: CurrentUser,
    file: UploadFile = File(...),
    points: str = Form(...),
    model: str = Form(default="mobile_sam"),
):
    """points: JSON array of {x,y,label} where label is 1=foreground 0=background."""
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
    return SegmentResponse(
        engine=result.get("engine", "sam"),
        model=result.get("model", model),
        points=result.get("points", []),
    )


@router.post("/pose", response_model=PoseResponse)
async def pose_in_image(
    _user: CurrentUser,
    file: UploadFile = File(...),
    x: float = Form(default=0),
    y: float = Form(default=0),
    model: str = Form(default="yolov8n-pose"),
    confidence: float = Form(default=0.25),
):
    mod = _require_ml(pose_module, "Pose estimation")
    raw = await _read_upload(file)
    point = {"x": x, "y": y} if x or y else None
    try:
        result = mod.estimate_pose(raw, point, model_id=model, confidence=confidence)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Pose estimation failed: {exc}") from exc
    return PoseResponse(
        engine=result.get("engine", "yolo-pose"),
        model=result.get("model", model),
        geometry=result.get("geometry"),
    )


@router.post("/prelabel", response_model=PrelabelResponse)
async def prelabel_dataset(payload: PrelabelRequest, user: CurrentUser):
    if not _ml_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML stack not installed. Run: pip install -r requirements-ml.txt",
        )
    from app.workers.ai_worker import run_prelabeling_task

    config = {
        "output": payload.output,
        "confidence": payload.confidence,
        "folder": payload.folder,
        "skip_existing": payload.skip_existing,
        "limit": payload.limit,
        "user_id": str(user.id),
    }
    run_prelabeling_task.delay(str(payload.dataset_id), payload.model, config)
    return PrelabelResponse(
        status="queued",
        message=f"Batch pre-label queued for dataset (model={payload.model}, output={payload.output})",
    )


async def _read_upload(file: UploadFile) -> bytes:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty image upload")
    return raw


def _require_ml(loader, label: str):
    try:
        mod = loader()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{label} module unavailable: {exc}",
        ) from exc
    if not mod.ml_available():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML stack not installed. Run: pip install -r requirements-ml.txt",
        )
    return mod
