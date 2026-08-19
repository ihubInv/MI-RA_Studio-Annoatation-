"""Audit log API."""
from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import CurrentUser, DB
from app.models.audit_log import AuditLog

router = APIRouter()


@router.get("/")
async def list_audit(
    current_user: CurrentUser,
    db: DB,
    resource_type: str | None = Query(None),
    resource_id: str | None = Query(None),
    limit: int = Query(100, ge=1, le=500),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit)
    if resource_type:
        stmt = stmt.where(AuditLog.resource_type == resource_type)
    if resource_id:
        stmt = stmt.where(AuditLog.resource_id == resource_id)
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "resource": "audit",
        "total": len(rows),
        "items": [
            {
                "id": str(r.id),
                "user_id": str(r.user_id) if r.user_id else None,
                "action": r.action,
                "resource_type": r.resource_type,
                "resource_id": r.resource_id,
                "after": r.after,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }
