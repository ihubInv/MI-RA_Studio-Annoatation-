"""SAM (Segment Anything) via Ultralytics."""
from __future__ import annotations

import io
from typing import Any

SAM_MODELS: dict[str, dict[str, str]] = {
    "mobile_sam": {"weights": "mobile_sam.pt", "label": "Mobile SAM (fast)"},
    "sam_b": {"weights": "sam_b.pt", "label": "SAM Base (accurate)"},
}

_cache: dict[str, Any] = {}


def ml_available() -> bool:
    try:
        import ultralytics  # noqa: F401

        return True
    except ImportError:
        return False


def list_models() -> list[dict[str, str]]:
    return [{"id": k, "task": "segment", **v} for k, v in SAM_MODELS.items()]


def _load(model_id: str):
    if model_id in _cache:
        return _cache[model_id]
    from ultralytics import SAM

    key = model_id if model_id in SAM_MODELS else "mobile_sam"
    model = SAM(SAM_MODELS[key]["weights"])
    _cache[model_id] = model
    return model, key


def _mask_to_points(mask_xy) -> list[dict[str, float]]:
    if mask_xy is None or len(mask_xy) == 0:
        return []
    ring = mask_xy[0]
    return [{"x": float(p[0]), "y": float(p[1])} for p in ring]


def segment_with_prompts(
    image_bytes: bytes,
    positive: list[dict[str, float]],
    negative: list[dict[str, float]] | None = None,
    model_id: str = "mobile_sam",
) -> dict[str, Any]:
    if not ml_available():
        raise RuntimeError("Ultralytics not installed. Run: pip install -r requirements-ml.txt")
    if not positive:
        raise ValueError("At least one foreground point required")

    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    model, key = _load(model_id)

    neg = negative or []
    points = [[p["x"], p["y"]] for p in positive] + [[p["x"], p["y"]] for p in neg]
    labels = [1] * len(positive) + [0] * len(neg)

    results = model.predict(img, points=points, labels=labels, verbose=False)
    result = results[0]
    if result.masks is None or len(result.masks) == 0:
        return {"engine": "sam", "model": key, "points": []}

    pts = _mask_to_points(result.masks.xy[0])
    return {"engine": "sam", "model": key, "points": pts}
