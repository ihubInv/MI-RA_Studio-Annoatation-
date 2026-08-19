"""Projects API — full CRUD."""
import math
import uuid

from fastapi import APIRouter, HTTPException, Query, status
from slugify import slugify
from sqlalchemy import select

from app.api.deps import CurrentUser, DB
from app.models.organization import Organization
from app.models.project import Project
from app.repositories.project_repo import ProjectRepository
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.audit_service import log_action

router = APIRouter()


@router.get("/", response_model=PaginatedResponse[ProjectRead])
async def list_projects(
    current_user: CurrentUser,
    db: DB,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    organization_id: uuid.UUID | None = Query(None),
):
    repo = ProjectRepository(db)
    offset = (page - 1) * page_size
    items = await repo.list_for_user(current_user.id, organization_id, page_size, offset)
    total = await repo.count_for_user(current_user.id, organization_id)
    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size)),
    )


@router.post("/", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create_project(payload: ProjectCreate, current_user: CurrentUser, db: DB):
    repo = ProjectRepository(db)
    org_id = payload.organization_id
    if not org_id or str(org_id) == "00000000-0000-0000-0000-000000000000":
        result = await db.execute(select(Organization).order_by(Organization.created_at.asc()).limit(1))
        org = result.scalar_one_or_none()
        if not org:
            org = Organization(name="MI-RA Lab", slug="mira-lab", description="Default organization")
            db.add(org)
            await db.flush()
        org_id = org.id
    slug = slugify(payload.name)
    # Ensure unique slug
    existing = await repo.get_by_slug(slug)
    if existing:
        slug = f"{slug}-{uuid.uuid4().hex[:6]}"
    project = Project(
        name=payload.name,
        slug=slug,
        description=payload.description,
        organization_id=org_id,
        created_by=current_user.id,
    )
    project = await repo.create(project)
    # Auto-add creator as project manager
    await repo.add_member(project.id, current_user.id, role="project_manager")
    await log_action(db, current_user.id, "create_project", "project", str(project.id))
    return project


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(project_id: uuid.UUID, current_user: CurrentUser, db: DB):
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: uuid.UUID, payload: ProjectUpdate, current_user: CurrentUser, db: DB
):
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    updates = payload.model_dump(exclude_none=True)
    project = await repo.update(project, **updates)
    await log_action(db, current_user.id, "update_project", "project", str(project.id), updates)
    return project


@router.delete("/{project_id}", response_model=MessageResponse)
async def delete_project(project_id: uuid.UUID, current_user: CurrentUser, db: DB):
    repo = ProjectRepository(db)
    project = await repo.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    await repo.delete(project)
    await log_action(db, current_user.id, "delete_project", "project", str(project_id))
    return MessageResponse(message="Project deleted successfully")
