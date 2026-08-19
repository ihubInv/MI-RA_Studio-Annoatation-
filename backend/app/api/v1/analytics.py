"""Analytics API — dataset / annotation / QA overview."""
from __future__ import annotations

from fastapi import APIRouter
from sqlalchemy import func, select

from app.api.deps import CurrentUser, DB
from app.models.annotation import Annotation
from app.models.annotation_object import AnnotationObject
from app.models.dataset import Dataset
from app.models.dataset_item import DatasetItem
from app.models.qa_result import QAResult
from app.models.review import Review
from app.models.task import Task

router = APIRouter()


@router.get("/")
@router.get("/overview")
async def overview(current_user: CurrentUser, db: DB):
    videos = (
        await db.execute(select(func.count()).select_from(DatasetItem).where(DatasetItem.mime_type.ilike("video/%")))
    ).scalar() or 0
    items = (await db.execute(select(func.count()).select_from(DatasetItem))).scalar() or 0
    datasets = (await db.execute(select(func.count()).select_from(Dataset))).scalar() or 0
    annotations = (await db.execute(select(func.count()).select_from(Annotation))).scalar() or 0
    objects = (await db.execute(select(func.count()).select_from(AnnotationObject))).scalar() or 0
    qa_rows = (await db.execute(select(func.count()).select_from(QAResult))).scalar() or 0
    reviews = (await db.execute(select(func.count()).select_from(Review))).scalar() or 0
    tasks = (await db.execute(select(func.count()).select_from(Task))).scalar() or 0
    frames = (await db.execute(select(func.coalesce(func.sum(DatasetItem.frame_count), 0)))).scalar() or 0
    return {
        "videos": int(videos),
        "items": int(items),
        "datasets": int(datasets),
        "annotations": int(annotations),
        "objects": int(objects),
        "total_frames": int(frames),
        "qa_results": int(qa_rows),
        "reviews": int(reviews),
        "tasks": int(tasks),
    }
