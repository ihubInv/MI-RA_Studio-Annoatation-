"""MI-RA Studio AI service: object detection."""
from .yolo import detect_objects, list_models, ml_available

__all__ = ["detect_objects", "list_models", "ml_available"]
