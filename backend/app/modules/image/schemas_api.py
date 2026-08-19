"""Annotation schemas — stored per dataset, consumed by the image studio."""
import math
import uuid

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DB
from app.models.annotation_attribute import AnnotationAttribute
from app.models.annotation_class import AnnotationClass
from app.models.annotation_schema import AnnotationSchema
from app.models.dataset import Dataset
from app.schemas.common import PaginatedResponse
from app.modules.image.label_schema import AnnotationSchemaRead, LabelSchemaBody
from app.services.audit_service import log_action

router = APIRouter()


def _read(schema: AnnotationSchema, dataset_id: uuid.UUID | None = None) -> dict:
    return {
        "id": schema.id,
        "name": schema.name,
        "description": schema.description,
        "version": schema.version,
        "project_id": schema.project_id,
        "dataset_id": dataset_id,
        "schema_definition": schema.schema_definition or {},
        "created_at": schema.created_at,
        "updated_at": schema.updated_at,
    }


async def _get_dataset(db, dataset_id: uuid.UUID) -> Dataset:
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return dataset


async def _replace_classes(db, schema: AnnotationSchema, body: LabelSchemaBody) -> None:
    existing = (
        await db.execute(select(AnnotationClass).where(AnnotationClass.schema_id == schema.id))
    ).scalars().all()
    for cls in existing:
        await db.delete(cls)
    await db.flush()
    for i, item in enumerate(body.classes):
        row = AnnotationClass(
            schema_id=schema.id,
            name=item.name,
            display_name=item.display_name or item.name,
            color=item.color,
            tools=[item.annotation_type] if item.annotation_type else [],
            hotkey=item.hotkey,
            sort_order=i,
            is_active=item.enabled,
        )
        db.add(row)
        await db.flush()
        for attr in item.attributes:
            db.add(
                AnnotationAttribute(
                    class_id=row.id,
                    name=attr.name,
                    input_type=attr.input_type,
                    values=attr.values or [],
                    is_required=attr.required,
                )
            )


async def _upsert_for_dataset(db, dataset: Dataset, body: LabelSchemaBody) -> AnnotationSchema:
    schema = None
    if dataset.annotation_schema_id:
        result = await db.execute(
            select(AnnotationSchema).where(AnnotationSchema.id == dataset.annotation_schema_id)
        )
        schema = result.scalar_one_or_none()
    if not schema:
        schema = AnnotationSchema(
            name=f"{dataset.name} labels",
            description="Studio label schema",
            version="1.0",
            project_id=dataset.project_id,
            schema_definition={},
            modalities=["image"],
        )
        db.add(schema)
        await db.flush()
        dataset.annotation_schema_id = schema.id
    schema.schema_definition = body.model_dump()
    schema.project_id = dataset.project_id
    await _replace_classes(db, schema, body)
    await db.flush()
    return schema


@router.get("/", response_model=PaginatedResponse[AnnotationSchemaRead])
async def list_schemas(
    current_user: CurrentUser,
    db: DB,
    project_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    stmt = select(AnnotationSchema)
    count_stmt = select(func.count()).select_from(AnnotationSchema)
    if project_id:
        stmt = stmt.where(AnnotationSchema.project_id == project_id)
        count_stmt = count_stmt.where(AnnotationSchema.project_id == project_id)
    total = int((await db.execute(count_stmt)).scalar_one() or 0)
    rows = (
        await db.execute(stmt.order_by(AnnotationSchema.updated_at.desc()).offset((page - 1) * page_size).limit(page_size))
    ).scalars().all()
    return PaginatedResponse(
        items=[AnnotationSchemaRead(**_read(s)) for s in rows],
        total=total,
        page=page,
        page_size=page_size,
        pages=max(1, math.ceil(total / page_size) if total else 1),
    )


@router.get("/dataset/{dataset_id}", response_model=AnnotationSchemaRead)
async def get_schema_for_dataset(dataset_id: uuid.UUID, current_user: CurrentUser, db: DB):
    dataset = await _get_dataset(db, dataset_id)
    if not dataset.annotation_schema_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No schema for dataset")
    schema = await db.get(AnnotationSchema, dataset.annotation_schema_id)
    if not schema:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No schema for dataset")
    return AnnotationSchemaRead(**_read(schema, dataset.id))


@router.put("/dataset/{dataset_id}", response_model=AnnotationSchemaRead)
async def save_schema_for_dataset(
    dataset_id: uuid.UUID, payload: LabelSchemaBody, current_user: CurrentUser, db: DB
):
    dataset = await _get_dataset(db, dataset_id)
    schema = await _upsert_for_dataset(db, dataset, payload)
    await log_action(db, current_user.id, "save_schema", "annotation_schema", str(schema.id))
    return AnnotationSchemaRead(**_read(schema, dataset.id))


@router.get("/{schema_id}", response_model=AnnotationSchemaRead)
async def get_schema(schema_id: uuid.UUID, current_user: CurrentUser, db: DB):
    schema = await db.get(AnnotationSchema, schema_id)
    if not schema:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schema not found")
    return AnnotationSchemaRead(**_read(schema))
