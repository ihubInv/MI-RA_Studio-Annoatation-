"""YOLO pose estimation via Ultralytics."""
from __future__ import annotations

import io
import math
from typing import Any

POSE_MODELS: dict[str, dict[str, str]] = {
    "yolov8n-pose": {"weights": "yolov8n-pose.pt", "label": "YOLOv8 Nano Pose"},
    "yolov8s-pose": {"weights": "yolov8s-pose.pt", "label": "YOLOv8 Small Pose"},
}

COCO_NAMES = [
    "nose",
    "left_eye",
    "right_eye",
    "left_ear",
    "right_ear",
    "left_shoulder",
    "right_shoulder",
    "left_elbow",
    "right_elbow",
    "left_wrist",
    "right_wrist",
    "left_hip",
    "right_hip",
    "left_knee",
    "right_knee",
    "left_ankle",
    "right_ankle",
]

COCO_EDGES = [
    [0, 1],
    [0, 2],
    [1, 3],
    [2, 4],
    [5, 6],
    [5, 7],
    [7, 9],
    [6, 8],
    [8, 10],
    [5, 11],
    [6, 12],
    [11, 12],
    [11, 13],
    [13, 15],
    [12, 14],
    [14, 16],
]

_cache: dict[str, Any] = {}


def ml_available() -> bool:
    try:
        import ultralytics  # noqa: F401

        return True
    except ImportError:
        return False


def list_models() -> list[dict[str, str]]:
    return [{"id": k, "task": "pose", **v} for k, v in POSE_MODELS.items()]


def _load(model_id: str):
    if model_id in _cache:
        return _cache[model_id]
    from ultralytics import YOLO

    key = model_id if model_id in POSE_MODELS else "yolov8n-pose"
    model = YOLO(POSE_MODELS[key]["weights"])
    _cache[model_id] = model
    return model, key


def _dist(ax: float, ay: float, bx: float, by: float) -> float:
    return math.hypot(ax - bx, ay - by)


def estimate_pose(
    image_bytes: bytes,
    point: dict[str, float] | None = None,
    model_id: str = "yolov8n-pose",
    confidence: float = 0.25,
) -> dict[str, Any]:
    if not ml_available():
        raise RuntimeError("Ultralytics not installed. Run: pip install -r requirements-ml.txt")

    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    model, key = _load(model_id)
    results = model.predict(img, conf=max(0.05, confidence), verbose=False)
    result = results[0]

    if result.keypoints is None or len(result.keypoints) == 0:
        return {"engine": "yolo-pose", "model": key, "geometry": None}

    px = point["x"] if point else img.width / 2
    py = point["y"] if point else img.height / 2

    best_idx = 0
    best_score = float("inf")
    kpts_xy = result.keypoints.xy
    kpts_conf = result.keypoints.conf

    for i in range(len(kpts_xy)):
        xy = kpts_xy[i].tolist()
        if result.boxes is not None and i < len(result.boxes):
            x1, y1, x2, y2 = result.boxes.xyxy[i].tolist()
            if px >= x1 and px <= x2 and py >= y1 and py <= y2:
                best_idx = i
                break
            cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
            d = _dist(px, py, cx, cy)
        else:
            xs = [p[0] for p in xy if p[0] > 0]
            ys = [p[1] for p in xy if p[1] > 0]
            if not xs:
                continue
            cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
            d = _dist(px, py, cx, cy)
        if d < best_score:
            best_score = d
            best_idx = i

    xy = kpts_xy[best_idx].tolist()
    conf = kpts_conf[best_idx].tolist() if kpts_conf is not None else [1.0] * len(xy)
    points = [{"x": float(p[0]), "y": float(p[1])} for p in xy]
    visibility = [2 if (i < len(conf) and conf[i] >= 0.5) else 0 for i in range(len(points))]

    return {
        "engine": "yolo-pose",
        "model": key,
        "geometry": {
            "points": points,
            "edges": COCO_EDGES,
            "names": COCO_NAMES,
            "visibility": visibility,
        },
    }
