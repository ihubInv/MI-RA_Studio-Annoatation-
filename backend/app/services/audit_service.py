"""Audit logging service helper."""
import uuid
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def log_action(
    db: AsyncSession,
    user_id: uuid.UUID,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    changes: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Fire-and-forget audit log entry."""
    entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        after=changes,
        ip_address=ip_address,
    )
    db.add(entry)
    # Don't flush here — will be committed with the parent transaction
