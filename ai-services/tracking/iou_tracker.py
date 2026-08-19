"""IoU-based multi-object tracker for video annotation assist (Phase 16 + 17)."""
from __future__ import annotations

from typing import Any


def ml_available() -> bool:
    return True


def list_models() -> list[dict[str, str]]:
    return [{"id": "iou_v1", "task": "track", "label": "IoU tracker (bbox)"}]


def _iou(a: dict[str, float], b: dict[str, float]) -> float:
    ax2 = a["x"] + a["width"]
    ay2 = a["y"] + a["height"]
    bx2 = b["x"] + b["width"]
    by2 = b["y"] + b["height"]
    ix1 = max(a["x"], b["x"])
    iy1 = max(a["y"], b["y"])
    ix2 = min(ax2, bx2)
    iy2 = min(ay2, by2)
    iw = max(0.0, ix2 - ix1)
    ih = max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    area_a = max(1.0, a["width"] * a["height"])
    area_b = max(1.0, b["width"] * b["height"])
    return inter / (area_a + area_b - inter)


def _center(g: dict[str, float]) -> tuple[float, float]:
    return (g["x"] + g["width"] / 2, g["y"] + g["height"] / 2)


def _predict_next(prev: dict[str, float], curr: dict[str, float]) -> dict[str, float]:
    """Linear extrapolation from last two boxes."""
    pcx, pcy = _center(prev)
    ccx, ccy = _center(curr)
    dx, dy = ccx - pcx, ccy - pcy
    nx, ny = ccx + dx, ccy + dy
    return {
        "x": nx - curr["width"] / 2,
        "y": ny - curr["height"] / 2,
        "width": curr["width"],
        "height": curr["height"],
    }


def match_boxes(
    prev: list[dict[str, Any]],
    curr: list[dict[str, Any]],
    *,
    min_iou: float = 0.2,
) -> list[tuple[int, int, float]]:
    """Return list of (prev_idx, curr_idx, iou_score) greedy matches."""
    pairs: list[tuple[float, int, int]] = []
    for i, p in enumerate(prev):
        pg = p.get("geometry") or p
        for j, c in enumerate(curr):
            cg = c.get("geometry") or c
            score = _iou(pg, cg)
            if score >= min_iou:
                pairs.append((score, i, j))
    pairs.sort(reverse=True)
    used_p: set[int] = set()
    used_c: set[int] = set()
    out: list[tuple[int, int, float]] = []
    for score, i, j in pairs:
        if i in used_p or j in used_c:
            continue
        used_p.add(i)
        used_c.add(j)
        out.append((i, j, score))
    return out


def propagate_tracks(
    *,
    seeds: list[dict[str, Any]],
    frames: list[dict[str, Any]],
    min_track_confidence: float = 0.25,
    retain_low_confidence: bool = True,
    id_switch_iou_threshold: float = 0.35,
    reid_iou_threshold: float = 0.15,
) -> dict[str, Any]:
    """
    Propagate seed boxes across per-frame detections.

    Phase 17 additions: gaps, low-confidence retention, ID-switch flags, re-ID candidates.
    """
    if not seeds or not frames:
        return {"tracks": [], "keyframes": [], "gaps": [], "id_switches": [], "reid_candidates": []}

    tracks: dict[str, dict[str, Any]] = {}
    for s in seeds:
        tid = str(s.get("track_id") or s.get("object_id") or "")
        if not tid:
            continue
        geom = s.get("geometry") or s
        tracks[tid] = {
            "track_id": tid,
            "class_name": s.get("class_name", "Object"),
            "keyframes": [],
            "gaps": [],
        }
        tracks[tid]["keyframes"].append(
            {
                "frame": frames[0]["frame"],
                "geometry": geom,
                "confidence": float(s.get("confidence") or 1.0),
                "track_confidence": 1.0,
                "match_iou": 1.0,
                "status": "matched",
                "needs_review": False,
            }
        )

    active: dict[str, dict[str, Any]] = {tid: {**(s.get("geometry") or s)} for tid, s in zip(tracks, seeds)}
    prev_geoms: dict[str, dict[str, Any]] = {tid: active[tid].copy() for tid in active}
    in_gap: dict[str, bool] = {tid: False for tid in tracks}
    gap_start: dict[str, int | None] = {tid: None for tid in tracks}
    track_ids = list(tracks.keys())

    keyframes: list[dict[str, Any]] = []
    id_switches: list[dict[str, Any]] = []
    reid_candidates: list[dict[str, Any]] = []

    for frame_data in frames[1:]:
        frame = frame_data["frame"]
        dets = frame_data.get("objects") or []
        prev_list = [{"geometry": active[tid]} for tid in track_ids if tid in active and not in_gap.get(tid)]
        active_tids = [tid for tid in track_ids if tid in active and not in_gap.get(tid)]
        matches = match_boxes(prev_list, dets)
        matched_curr: set[int] = set()
        matched_tids: set[str] = set()

        for prev_i, curr_i, iou_score in matches:
            tid = active_tids[prev_i]
            det = dets[curr_i]
            geom = det.get("geometry") or det
            conf = float(det.get("confidence") or 0)
            track_conf = min(1.0, iou_score * max(conf, 0.01))

            status = "matched"
            needs_review = False
            if track_conf < min_track_confidence:
                if retain_low_confidence:
                    status = "low_confidence"
                    needs_review = True
                else:
                    if not in_gap[tid]:
                        in_gap[tid] = True
                        gap_start[tid] = frame
                    continue

            if iou_score < id_switch_iou_threshold:
                status = "id_switch_suspect"
                needs_review = True
                id_switches.append(
                    {
                        "track_id": tid,
                        "frame": frame,
                        "match_iou": round(iou_score, 4),
                        "track_confidence": round(track_conf, 4),
                        "class_name": tracks[tid]["class_name"],
                    }
                )

            prev_geom = prev_geoms.get(tid, active.get(tid, geom))
            pcx, pcy = _center(prev_geom)
            ccx, ccy = _center(geom)
            diag = max(1.0, (prev_geom["width"] ** 2 + prev_geom["height"] ** 2) ** 0.5)
            motion = ((ccx - pcx) ** 2 + (ccy - pcy) ** 2) ** 0.5 / diag
            if motion > 2.5 and iou_score < 0.5:
                status = "id_switch_suspect"
                needs_review = True
                if not any(s["track_id"] == tid and s["frame"] == frame for s in id_switches):
                    id_switches.append(
                        {
                            "track_id": tid,
                            "frame": frame,
                            "match_iou": round(iou_score, 4),
                            "track_confidence": round(track_conf, 4),
                            "class_name": tracks[tid]["class_name"],
                            "reason": "motion_jump",
                        }
                    )

            if in_gap[tid] and gap_start[tid] is not None:
                tracks[tid]["gaps"].append({"start_frame": gap_start[tid], "end_frame": frame - 1})
                in_gap[tid] = False
                gap_start[tid] = None
                reid_candidates.append(
                    {
                        "track_id": tid,
                        "frame": frame,
                        "reid_score": round(iou_score, 4),
                        "geometry": geom,
                        "class_name": tracks[tid]["class_name"],
                    }
                )

            prev_geoms[tid] = active[tid].copy()
            active[tid] = geom
            matched_curr.add(curr_i)
            matched_tids.add(tid)

            kf = {
                "track_id": tid,
                "class_name": tracks[tid]["class_name"],
                "frame": frame,
                "geometry": geom,
                "confidence": conf,
                "track_confidence": round(track_conf, 4),
                "match_iou": round(iou_score, 4),
                "status": status,
                "needs_review": needs_review,
            }
            tracks[tid]["keyframes"].append(kf)
            keyframes.append(kf)

        for tid in track_ids:
            if tid in matched_tids or tid not in active:
                continue
            if not in_gap[tid]:
                in_gap[tid] = True
                gap_start[tid] = frame

            if in_gap[tid] and dets:
                class_name = tracks[tid]["class_name"]
                kfs = tracks[tid]["keyframes"]
                predict = _predict_next(kfs[-2]["geometry"], kfs[-1]["geometry"]) if len(kfs) >= 2 else active[tid]
                best_j = -1
                best_score = reid_iou_threshold
                for j, det in enumerate(dets):
                    if j in matched_curr:
                        continue
                    if det.get("class_name", "Object") != class_name:
                        continue
                    geom = det.get("geometry") or det
                    score = _iou(predict, geom)
                    if score > best_score:
                        best_score = score
                        best_j = j
                if best_j >= 0:
                    det = dets[best_j]
                    geom = det.get("geometry") or det
                    reid_candidates.append(
                        {
                            "track_id": tid,
                            "frame": frame,
                            "reid_score": round(best_score, 4),
                            "geometry": geom,
                            "class_name": class_name,
                            "predicted": True,
                        }
                    )

    gaps_out: list[dict[str, Any]] = []
    for tid, tr in tracks.items():
        for g in tr.get("gaps", []):
            gaps_out.append({"track_id": tid, "class_name": tr["class_name"], **g})
        if in_gap.get(tid) and gap_start.get(tid) is not None and frames:
            gaps_out.append(
                {
                    "track_id": tid,
                    "class_name": tr["class_name"],
                    "start_frame": gap_start[tid],
                    "end_frame": frames[-1]["frame"],
                    "open": True,
                }
            )

    return {
        "engine": "iou",
        "model": "iou_v1",
        "tracks": [{"track_id": t["track_id"], "class_name": t["class_name"], "keyframes": t["keyframes"]} for t in tracks.values()],
        "keyframes": keyframes,
        "gaps": gaps_out,
        "id_switches": id_switches,
        "reid_candidates": reid_candidates,
    }
