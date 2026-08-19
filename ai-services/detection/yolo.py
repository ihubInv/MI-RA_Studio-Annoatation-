"""YOLO pretrained detection for MI-RA Studio (Ultralytics)."""
from __future__ import annotations

import io
from typing import Any, Literal

OutputMode = Literal["bbox", "polygon", "mask"]

MODEL_CATALOG: dict[str, dict[str, str]] = {
    "yolov8n": {"weights": "yolov8n.pt", "task": "detect", "label": "YOLOv8 Nano (bbox)"},
    "yolov8s": {"weights": "yolov8s.pt", "task": "detect", "label": "YOLOv8 Small (bbox)"},
    "yolov8n-seg": {"weights": "yolov8n-seg.pt", "task": "segment", "label": "YOLOv8 Nano Seg (polygon)"},
    "yolov8s-seg": {"weights": "yolov8s-seg.pt", "task": "segment", "label": "YOLOv8 Small Seg (polygon)"},
}

_model_cache: dict[str, Any] = {}


def ml_available() -> bool:
    try:
        import ultralytics  # noqa: F401

        return True
    except ImportError:
        return False


def list_models() -> list[dict[str, str]]:
    return [{"id": k, **v} for k, v in MODEL_CATALOG.items()]


def _pick_model(model_id: str, output: OutputMode) -> str:
    if model_id in MODEL_CATALOG:
        return model_id
    if output in ("polygon", "mask"):
        return "yolov8n-seg"
    return "yolov8n"


def _load_model(model_id: str):
    if model_id in _model_cache:
        return _model_cache[model_id]
    from ultralytics import YOLO

    weights = MODEL_CATALOG[model_id]["weights"]
    model = YOLO(weights)
    _model_cache[model_id] = model
    return model


def _mask_to_polygon(mask_xy) -> list[dict[str, float]]:
    if mask_xy is None or len(mask_xy) == 0:
        return []
    pts = mask_xy[0] if hasattr(mask_xy[0], "__len__") and len(mask_xy) > 0 else mask_xy
    out: list[dict[str, float]] = []
    for p in pts:
        out.append({"x": float(p[0]), "y": float(p[1])})
    return out


def detect_objects(
    image_bytes: bytes,
    *,
    model_id: str = "yolov8n",
    output: OutputMode = "bbox",
    confidence: float = 0.25,
    classes: list[str] | None = None,
    max_det: int = 100,
) -> dict[str, Any]:
    if not ml_available():
        raise RuntimeError(
            "Ultralytics is not installed. Run: pip install -r requirements-ml.txt"
        )

    from PIL import Image

    model_key = _pick_model(model_id, output)
    meta = MODEL_CATALOG[model_key]
    if output in ("polygon", "mask") and meta["task"] != "segment":
        model_key = "yolov8n-seg"
        meta = MODEL_CATALOG[model_key]

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    model = _load_model(model_key)
    results = model.predict(
        img,
        conf=max(0.05, min(confidence, 0.95)),
        verbose=False,
        max_det=max_det,
    )
    result = results[0]
    names = result.names or {}
    class_filter = {c.strip().lower() for c in (classes or []) if c.strip()}

    objects: list[dict[str, Any]] = []

    if meta["task"] == "segment" and result.masks is not None and output in ("polygon", "mask"):
        boxes = result.boxes
        for i, box in enumerate(boxes or []):
            cls_id = int(box.cls[0])
            class_name = str(names.get(cls_id, f"class_{cls_id}"))
            if class_filter and class_name.lower() not in class_filter:
                continue
            conf = float(box.conf[0])
            points = _mask_to_polygon(result.masks.xy[i] if i < len(result.masks.xy) else None)
            if len(points) < 3:
                xyxy = box.xyxy[0].tolist()
                x1, y1, x2, y2 = xyxy
                objects.append(
                    {
                        "class_name": class_name,
                        "confidence": round(conf, 4),
                        "tool_type": "bbox",
                        "geometry": {
                            "x": x1,
                            "y": y1,
                            "w": x2 - x1,
                            "h": y2 - y1,
                            "rotation": 0,
                        },
                    }
                )
                continue
            objects.append(
                {
                    "class_name": class_name,
                    "confidence": round(conf, 4),
                    "tool_type": "instance_seg" if output == "polygon" else "polygon_mask",
                    "geometry": {"points": points},
                }
            )
        return {
            "engine": "yolo",
            "model": model_key,
            "output": output,
            "objects": objects,
        }

    for box in result.boxes or []:
        cls_id = int(box.cls[0])
        class_name = str(names.get(cls_id, f"class_{cls_id}"))
        if class_filter and class_name.lower() not in class_filter:
            continue
        conf = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()
        objects.append(
            {
                "class_name": class_name,
                "confidence": round(conf, 4),
                "tool_type": "bbox",
                "geometry": {
                    "x": x1,
                    "y": y1,
                    "w": x2 - x1,
                    "h": y2 - y1,
                    "rotation": 0,
                },
            }
        )

    return {
        "engine": "yolo",
        "model": model_key,
        "output": output,
        "objects": objects,
    }
