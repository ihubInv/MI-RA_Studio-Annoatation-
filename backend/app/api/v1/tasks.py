"""Tasks API — full CRUD with assignment."""
import math
import uuid

from fastapi import APIRouter, HTTPException, Query, status

from app.api.deps import CurrentUser, DB
from app.models.task import Task
from app.models.assignment import Assignment
from app.repositories.task_repo import TaskRepository
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.task import AssignmentCreate, AssignmentRead, TaskCreate, TaskRead, TaskUpdate
from app.services.audit_service import log_action

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[TaskRead])
async def list_tasks(
    current_user: CurrentUser,
    db: DB,
    project_id: uuid.UUID = Query(...),
    status_filter: str | None = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    repo = TaskRepository(db)
    offset = (page - 1) * page_size
    items = await repo.list_for_project(project_id, status_filter, page_size, offset)
    total = await repo.count(project_id=project_id)
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.get("/my-tasks", response_model=PaginatedResponse[TaskRead])
async def my_tasks(
    current_user: CurrentUser,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    repo = TaskRepository(db)
    offset = (page - 1) * page_size
    items = await repo.list_assigned_to_user(current_user.id, page_size, offset)
    return PaginatedResponse(items=items, total=len(items), page=page, page_size=page_size, pages=1)


@router.post("/", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(payload: TaskCreate, current_user: CurrentUser, db: DB):
    repo = TaskRepository(db)
    task = Task(**payload.model_dump())
    task = await repo.create(task)
    await log_action(db, current_user.id, "create_task", "task", str(task.id))
    return task


@router.get("/{task_id}", response_model=TaskRead)
async def get_task(task_id: uuid.UUID, current_user: CurrentUser, db: DB):
    repo = TaskRepository(db)
    task = await repo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: uuid.UUID, payload: TaskUpdate, current_user: CurrentUser, db: DB
):
    repo = TaskRepository(db)
    task = await repo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    task = await repo.update(task, **payload.model_dump(exclude_none=True))
    await log_action(db, current_user.id, "update_task", "task", str(task_id))
    return task


@router.post("/{task_id}/assign", response_model=AssignmentRead)
async def assign_task(task_id: uuid.UUID, payload: AssignmentCreate, current_user: CurrentUser, db: DB):
    repo = TaskRepository(db)
    task = await repo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    assignment = Assignment(task_id=task_id, assignee_id=payload.assignee_id)
    db.add(assignment)
    await db.flush()
    await repo.update(task, status="assigned")
    await log_action(db, current_user.id, "assign_task", "task", str(task_id))
    return assignment


@router.delete("/{task_id}", response_model=MessageResponse)
async def delete_task(task_id: uuid.UUID, current_user: CurrentUser, db: DB):
    repo = TaskRepository(db)
    task = await repo.get_by_id(task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    await repo.delete(task)
    await log_action(db, current_user.id, "delete_task", "task", str(task_id))
    return MessageResponse(message="Task deleted")
