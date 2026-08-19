"""Dataset export — JSON, COCO, YOLO, VOC, LabelMe, CSV."""
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.api.deps import CurrentUser, DB
from app.services.export_service import build_export_zip, collect_export_rows

router = APIRouter()


class ExportRequest(BaseModel):
    dataset_id: uuid.UUID
    format: str = "json"
    folder: str | None = None
    item_ids: list[uuid.UUID] | None = None
    include_images: bool = False
    recursive: bool = True


@router.get("/")
async def list_exports():
    return {
        "resource": "exports",
        "formats": ["json", "coco", "yolo", "voc", "labelme", "csv"],
        "items": [],
        "total": 0,
    }


@router.post("/")
async def create_export(payload: ExportRequest, current_user: CurrentUser, db: DB):
    fmt = payload.format.lower()
    if fmt not in {"json", "coco", "yolo", "voc", "labelme", "csv"}:
        raise HTTPException(status_code=400, detail="Unsupported export format")
    try:
        dataset, rows = await collect_export_rows(
            db,
            payload.dataset_id,
            folder=payload.folder,
            item_ids=payload.item_ids,
            recursive=payload.recursive,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    blob = build_export_zip(dataset, rows, fmt, payload.include_images)
    filename = f"{dataset.name}-{fmt}.zip".replace(" ", "_")
    return Response(
        content=blob,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
