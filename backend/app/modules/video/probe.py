"""FFprobe-based video metadata extraction."""
from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from fractions import Fraction
from pathlib import Path
from typing import Any

PROBE_VERSION = "1"


def _ffprobe_path() -> str:
    return shutil.which("ffprobe") or "ffprobe"


def _run_ffprobe(path: str) -> dict[str, Any]:
    cmd = [
        _ffprobe_path(),
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        path,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    except FileNotFoundError as exc:
        return {"error": "ffprobe is not installed. Install FFmpeg to upload videos."}

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip() or "ffprobe could not read this file"
        return {"error": err}

    try:
        payload = json.loads(proc.stdout or "{}")
    except json.JSONDecodeError:
        return {"error": "ffprobe returned invalid metadata"}

    return payload


def _parse_fps(raw: str | None, avg: str | None) -> tuple[float, dict[str, int] | None]:
    for candidate in (raw, avg):
        if not candidate or candidate in {"0/0", "N/A"}:
            continue
        try:
            frac = Fraction(candidate)
            if frac.numerator <= 0 or frac.denominator <= 0:
                continue
            return float(frac), {"num": frac.numerator, "den": frac.denominator}
        except (ValueError, ZeroDivisionError):
            continue
    return 0.0, None


def _build_probe(raw: dict[str, Any]) -> dict[str, Any]:
    if raw.get("error"):
        return {"error": raw["error"]}

    streams = raw.get("streams") or []
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    fmt = raw.get("format") or {}

    if not video:
        return {"error": "No video stream found in file"}

    fps, fps_rational = _parse_fps(video.get("r_frame_rate"), video.get("avg_frame_rate"))
    duration = float(fmt.get("duration") or video.get("duration") or 0)
    if duration <= 0 and fps > 0 and video.get("nb_frames"):
        try:
            duration = int(video["nb_frames"]) / fps
        except (TypeError, ValueError):
            pass

    frame_count = None
    if video.get("nb_frames"):
        try:
            frame_count = int(video["nb_frames"])
        except (TypeError, ValueError):
            frame_count = None
    if frame_count is None and duration > 0 and fps > 0:
        frame_count = int(round(duration * fps))

    width = int(video.get("width") or 0)
    height = int(video.get("height") or 0)
    bitrate = int(fmt.get("bit_rate") or video.get("bit_rate") or 0)

    display_ratio = video.get("display_aspect_ratio") or fmt.get("display_aspect_ratio")
    aspect_ratio = display_ratio
    if not aspect_ratio and width and height:
        aspect_ratio = f"{width}:{height}"

    probe: dict[str, Any] = {
        "probe_version": PROBE_VERSION,
        "container": (fmt.get("format_name") or "").split(",")[0].lower(),
        "codec": (video.get("codec_name") or "").lower(),
        "codec_long": video.get("codec_long_name"),
        "profile": video.get("profile"),
        "pixel_format": video.get("pix_fmt"),
        "color_space": video.get("color_space") or video.get("color_transfer"),
        "bitrate_bps": bitrate,
        "aspect_ratio": aspect_ratio,
        "display_aspect_ratio": display_ratio,
        "fps": fps,
        "duration_sec": duration,
        "frame_count": frame_count,
        "width": width,
        "height": height,
        "rotation": int(video.get("tags", {}).get("rotate") or 0),
        "has_audio": audio is not None,
    }
    if fps_rational:
        probe["fps_rational"] = fps_rational
    if audio:
        probe["audio"] = {
            "codec": audio.get("codec_name"),
            "channels": int(audio.get("channels") or 0),
            "sample_rate": int(float(audio.get("sample_rate") or 0)),
            "bitrate_bps": int(audio.get("bit_rate") or 0),
        }
    return probe


def probe_video_path(path: str | Path) -> dict[str, Any]:
    return _build_probe(_run_ffprobe(str(path)))


def probe_video_bytes(data: bytes, *, suffix: str = ".mp4") -> dict[str, Any]:
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(data)
        tmp_path = tmp.name
    try:
        return probe_video_path(tmp_path)
    finally:
        Path(tmp_path).unlink(missing_ok=True)


def extract_poster_frame(path: str | Path, *, at_sec: float = 0.0) -> bytes | None:
    ffmpeg = shutil.which("ffmpeg") or "ffmpeg"
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as out:
        out_path = out.name
    cmd = [
        ffmpeg,
        "-hide_banner",
        "-loglevel",
        "error",
        "-ss",
        str(at_sec),
        "-i",
        str(path),
        "-frames:v",
        "1",
        "-q:v",
        "2",
        "-y",
        out_path,
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
        if proc.returncode != 0:
            return None
        return Path(out_path).read_bytes()
    except FileNotFoundError:
        return None
    finally:
        Path(out_path).unlink(missing_ok=True)
