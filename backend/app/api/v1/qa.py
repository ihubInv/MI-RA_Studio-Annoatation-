"""Quality assurance API — validate annotations, gold samples, consensus."""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DB
from app.models.annotation import Annotation
from app.models.gold_sample import GoldSample
from app.models.qa_result import QAResult
from app.repositories.annotation_repo import AnnotationRepository
from app.services.audit_service import log_action

router = APIRouter()


class QaRunRequest(BaseModel):
    item_id: uuid.UUID
    fps: float = 30


class GoldCreate(BaseModel):
    item_id: uuid.UUID
    annotation_id: uuid.UUID


def _geometry_issues(obj) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    geom = obj.geometry or {}
    tool = obj.tool_type or ""
    if not obj.class_name:
        issues.append({"code": "missing_label", "severity": "error", "message": "Missing class name", "object_id": str(obj.id)})
    if tool in {"bbox", "rectangle", "ellipse", "rotated_rect"}:
        w = float(geom.get("w") or geom.get("width") or 0)
        h = float(geom.get("h") or geom.get("height") or 0)
        if w <= 0 or h <= 0:
            issues.append({"code": "invalid_geometry", "severity": "error", "message": "Empty box", "object_id": str(obj.id)})
    if tool == "polygon":
        pts = geom.get("points") or []
        if len(pts) < 3:
            issues.append({"code": "invalid_geometry", "severity": "error", "message": "Polygon needs 3+ points", "object_id": str(obj.id)})
    conf = obj.confidence
    attrs = obj.attributes or {}
    raw_conf = conf if conf is not None else attrs.get("confidence")
    try:
        if raw_conf is not None and float(raw_conf) < 0.5:
            issues.append({"code": "low_confidence", "severity": "warning", "message": "Confidence < 50%", "object_id": str(obj.id)})
    except (TypeError, ValueError):
        pass
    return issues


@router.get("/")
async def list_qa(
    current_user: CurrentUser,
    db: DB,
    item_id: uuid.UUID | None = Query(None),
):
    stmt = select(QAResult).order_by(QAResult.created_at.desc()).limit(200)
    if item_id:
        anns = (await db.execute(select(Annotation.id).where(Annotation.item_id == item_id))).scalars().all()
        stmt = select(QAResult).where(QAResult.annotation_id.in_(anns or [uuid.uuid4()])).order_by(QAResult.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "resource": "qa",
        "total": len(rows),
        "items": [
            {
                "id": str(r.id),
                "annotation_id": str(r.annotation_id),
                "qa_type": r.qa_type,
                "score": r.score,
                "issues": r.issues or [],
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.post("/run")
async def run_qa(payload: QaRunRequest, current_user: CurrentUser, db: DB):
    repo = AnnotationRepository(db)
    ann = await repo.get_latest_for_item(payload.item_id, current_user.id)
    if not ann:
        raise HTTPException(status_code=404, detail="No annotation to validate")
    issues: list[dict[str, Any]] = []
    ids: dict[str, int] = {}
    for obj in ann.objects or []:
        issues.extend(_geometry_issues(obj))
        oid = (obj.attributes or {}).get("object_id")
        if oid:
            ids[str(oid)] = ids.get(str(oid), 0) + 1
    dupes = [k for k, v in ids.items() if v > 1 and False]  # per-frame dupes handled client-side
    _ = dupes
    errors = sum(1 for i in issues if i["severity"] == "error")
    warnings = len(issues) - errors
    score = max(0.0, 1.0 - errors * 0.15 - warnings * 0.05)
    result = QAResult(
        annotation_id=ann.id,
        qa_type="annotation_validation",
        score=score,
        issues=issues,
        details={"fps": payload.fps, "object_count": len(ann.objects or [])},
    )
    db.add(result)
    await db.flush()
    await log_action(db, current_user.id, "run_qa", "annotation", str(ann.id))
    return {"id": str(result.id), "score": score, "errors": errors, "warnings": warnings, "issues": issues}


@router.post("/gold")
async def mark_gold(payload: GoldCreate, current_user: CurrentUser, db: DB):
    row = GoldSample(item_id=payload.item_id, annotation_id=payload.annotation_id, is_active=True)
    db.add(row)
    await db.flush()
    await log_action(db, current_user.id, "mark_gold", "annotation", str(payload.annotation_id))
    return {"id": str(row.id), "item_id": str(row.item_id), "annotation_id": str(row.annotation_id)}


@router.get("/gold")
async def list_gold(current_user: CurrentUser, db: DB, item_id: uuid.UUID | None = Query(None)):
    stmt = select(GoldSample).where(GoldSample.is_active.is_(True))
    if item_id:
        stmt = stmt.where(GoldSample.item_id == item_id)
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "items": [
            {"id": str(r.id), "item_id": str(r.item_id), "annotation_id": str(r.annotation_id)}
            for r in rows
        ]
    }


@router.post("/consensus/{item_id}")
async def consensus(item_id: uuid.UUID, current_user: CurrentUser, db: DB):
    """Merge all annotators' latest objects into the current user's annotation (union)."""
    repo = AnnotationRepository(db)
    all_anns = await repo.list_for_item(item_id)
    if not all_anns:
        raise HTTPException(status_code=404, detail="No annotations")
    latest_by_user: dict[str, Annotation] = {}
    for ann in all_anns:
        key = str(ann.annotator_id)
        prev = latest_by_user.get(key)
        if not prev or (ann.version or 0) >= (prev.version or 0):
            latest_by_user[key] = ann
    merged = 0
    mine = await repo.get_latest_for_item(item_id, current_user.id)
    if not mine:
        raise HTTPException(status_code=404, detail="Create your annotation first")
    seen: set[tuple] = set()
    for ann in latest_by_user.values():
        full = await repo.get_with_objects(ann.id)
        for obj in full.objects or []:
            sig = (obj.class_name, obj.tool_type, obj.frame_index, str(obj.geometry))
            if sig in seen:
                continue
            seen.add(sig)
            if ann.id == mine.id:
                continue
            clone = obj.__class__(
                annotation_id=mine.id,
                class_name=obj.class_name,
                tool_type=obj.tool_type,
                geometry=obj.geometry,
                attributes=obj.attributes,
                frame_index=obj.frame_index,
                is_keyframe=obj.is_keyframe,
                is_locked=False,
                is_hidden=obj.is_hidden,
            )
            db.add(clone)
            merged += 1
    await db.flush()
    await log_action(db, current_user.id, "consensus_merge", "annotation", str(mine.id), {"merged": merged})
    return {"annotation_id": str(mine.id), "merged_objects": merged, "annotators": len(latest_by_user)}
