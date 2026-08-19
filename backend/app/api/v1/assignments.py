"""Assignments API — list and create task assignments."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DB
from app.models.assignment import Assignment
from app.models.task import Task, TaskStatus
from app.services.audit_service import log_action

router = APIRouter()


class AssignmentBody(BaseModel):
    task_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    dataset_id: uuid.UUID | None = None
    name: str | None = None
    assignee_id: uuid.UUID
    item_ids: list[uuid.UUID] | None = None


@router.get("/")
async def list_assignments(
    current_user: CurrentUser,
    db: DB,
    assignee_id: uuid.UUID | None = Query(None),
    task_id: uuid.UUID | None = Query(None),
):
    stmt = select(Assignment).order_by(Assignment.created_at.desc()).limit(200)
    if assignee_id:
        stmt = stmt.where(Assignment.assignee_id == assignee_id)
    if task_id:
        stmt = stmt.where(Assignment.task_id == task_id)
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "resource": "assignments",
        "total": len(rows),
        "items": [
            {
                "id": str(r.id),
                "task_id": str(r.task_id),
                "assignee_id": str(r.assignee_id),
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.post("/")
async def create_assignment(payload: AssignmentBody, current_user: CurrentUser, db: DB):
    task_id = payload.task_id
    if not task_id:
        if not payload.project_id:
            raise HTTPException(status_code=400, detail="task_id or project_id is required")
        task = Task(
            project_id=payload.project_id,
            dataset_id=payload.dataset_id,
            name=payload.name or "Video assignment",
            status=TaskStatus.ASSIGNED,
            item_ids=[str(i) for i in (payload.item_ids or [])],
        )
        db.add(task)
        await db.flush()
        task_id = task.id
    else:
        task = await db.get(Task, task_id)
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        task.status = TaskStatus.ASSIGNED
    row = Assignment(task_id=task_id, assignee_id=payload.assignee_id, status="pending")
    db.add(row)
    await db.flush()
    await log_action(db, current_user.id, "create_assignment", "task", str(task_id))
    return {"id": str(row.id), "task_id": str(task_id), "assignee_id": str(payload.assignee_id), "status": row.status}


@router.patch("/{assignment_id}")
async def update_assignment(
    assignment_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    status_value: str = Query(..., alias="status"),
):
    row = await db.get(Assignment, assignment_id)
    if not row:
        raise HTTPException(status_code=404, detail="Assignment not found")
    row.status = status_value
    await log_action(db, current_user.id, "update_assignment", "assignment", str(assignment_id))
    return {"id": str(row.id), "status": row.status}
