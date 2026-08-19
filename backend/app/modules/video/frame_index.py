"""Frame ↔ timestamp lookup for video items."""
from __future__ import annotations

from fractions import Fraction
from typing import Any

PROCESSING_VERSION = "1"
FRAME_INDEX_VERSION = "1"


def _fps_fraction(fps: float, fps_rational: dict[str, int] | None) -> Fraction:
    if fps_rational and fps_rational.get("num") and fps_rational.get("den"):
        return Fraction(fps_rational["num"], fps_rational["den"])
    if fps > 0:
        return Fraction(str(fps)).limit_denominator(10_000)
    return Fraction(0, 1)


def frame_to_time_sec(
    frame_index: int,
    *,
    fps: float,
    fps_rational: dict[str, int] | None = None,
) -> float:
    frac = _fps_fraction(fps, fps_rational)
    if frac <= 0:
        return 0.0
    return float(Fraction(frame_index) / frac)


def time_sec_to_frame(
    time_sec: float,
    *,
    fps: float,
    fps_rational: dict[str, int] | None = None,
    frame_count: int | None = None,
) -> int:
    frac = _fps_fraction(fps, fps_rational)
    if frac <= 0:
        return 0
    frame = int(Fraction(str(max(0.0, time_sec))) * frac)
    if frame_count is not None:
        frame = min(frame, max(0, frame_count - 1))
    return max(0, frame)


def build_frame_index(probe: dict[str, Any], *, keyframe_timestamps: list[float] | None = None) -> dict[str, Any]:
    fps = float(probe.get("fps") or 0)
    fps_rational = probe.get("fps_rational")
    duration = float(probe.get("duration_sec") or 0)
    frame_count = probe.get("frame_count")
    if frame_count is None and duration > 0 and fps > 0:
        frame_count = int(round(duration * fps))

    keyframes = keyframe_timestamps or probe.get("gop", {}).get("keyframe_timestamps_sec") or []
    if not keyframes and frame_count:
        keyframes = [frame_to_time_sec(0, fps=fps, fps_rational=fps_rational)]

    return {
        "version": FRAME_INDEX_VERSION,
        "frame_count": int(frame_count or 0),
        "fps": fps,
        "fps_rational": fps_rational,
        "duration_sec": duration,
        "keyframes": keyframes[:500],
    }


def lookup_frame(frame_index: dict[str, Any], *, frame: int | None = None, time_sec: float | None = None) -> dict[str, Any]:
    fps = float(frame_index.get("fps") or 0)
    fps_rational = frame_index.get("fps_rational")
    frame_count = int(frame_index.get("frame_count") or 0)

    if frame is not None:
        if frame_count and frame >= frame_count:
            raise ValueError(f"Frame index {frame} is out of range (0–{frame_count - 1})")
        ts = frame_to_time_sec(frame, fps=fps, fps_rational=fps_rational)
        return {"frame_index": frame, "time_sec": ts}

    if time_sec is not None:
        idx = time_sec_to_frame(time_sec, fps=fps, fps_rational=fps_rational, frame_count=frame_count or None)
        ts = frame_to_time_sec(idx, fps=fps, fps_rational=fps_rational)
        return {"frame_index": idx, "time_sec": ts}

    raise ValueError("Provide frame_index or time_sec")
