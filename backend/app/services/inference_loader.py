"""Load ai-services modules (folder names use hyphens)."""
from __future__ import annotations

import importlib.util
import sys
from functools import lru_cache
from pathlib import Path
from types import ModuleType


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _load_file(name: str, rel_path: str) -> ModuleType:
    path = _repo_root() / rel_path
    if not path.is_file():
        raise RuntimeError(f"Module not found at {path}")
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Failed to load module spec for {path}")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


@lru_cache(maxsize=1)
def detection_module() -> ModuleType:
    return _load_file("mira_ai_detection", "ai-services/detection/yolo.py")


@lru_cache(maxsize=1)
def segmentation_module() -> ModuleType:
    return _load_file("mira_ai_segmentation", "ai-services/segmentation/sam.py")


@lru_cache(maxsize=1)
def pose_module() -> ModuleType:
    return _load_file("mira_ai_pose", "ai-services/pose/yolo_pose.py")


@lru_cache(maxsize=1)
def tracking_module() -> ModuleType:
    return _load_file("mira_ai_tracking", "ai-services/tracking/iou_tracker.py")
