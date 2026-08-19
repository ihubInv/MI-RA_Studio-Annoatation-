"""Video audio extraction — Phase 22."""
from __future__ import annotations

import shutil
import struct
import subprocess
import tempfile
from pathlib import Path
from typing import Any


def _ffmpeg_path() -> str:
    return shutil.which("ffmpeg") or "ffmpeg"


def extract_waveform_peaks(
    local_path: str | Path,
    *,
    buckets: int = 2048,
    sample_rate: int = 8000,
) -> dict[str, Any]:
    """Task 22.1 — mono PCM peaks via ffmpeg for timeline waveform."""
    path = str(local_path)
    cmd = [
        _ffmpeg_path(),
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        path,
        "-vn",
        "-ac",
        "1",
        "-ar",
        str(sample_rate),
        "-f",
        "f32le",
        "pipe:1",
    ]
    proc = subprocess.run(cmd, capture_output=True, check=False)
    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or b"ffmpeg failed").decode("utf-8", errors="replace")
        raise RuntimeError(err.strip() or "ffmpeg audio extraction failed")

    raw = proc.stdout
    if len(raw) < 4:
        return {"duration_sec": 0.0, "sample_rate": sample_rate, "buckets": buckets, "peaks": []}

    count = len(raw) // 4
    samples = struct.unpack(f"<{count}f", raw[: count * 4])
    block = max(1, count // buckets)
    peaks: list[float] = []
    for i in range(buckets):
        start = i * block
        end = min(start + block, count)
        peak = max((abs(samples[j]) for j in range(start, end)), default=0.0)
        peaks.append(float(peak))

    max_peak = max(peaks) if peaks else 1.0
    if max_peak > 0:
        peaks = [p / max_peak for p in peaks]

    duration_sec = count / sample_rate if sample_rate else 0.0
    return {
        "duration_sec": duration_sec,
        "sample_rate": sample_rate,
        "buckets": buckets,
        "peaks": peaks,
    }
