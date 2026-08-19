"""AI pre-annotation Celery worker (GPU / CPU)."""
import asyncio
import selectors
import sys
import uuid

import structlog

from app.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(name="app.workers.ai_worker.run_prelabeling_task", bind=True, max_retries=2)
def run_prelabeling_task(self, dataset_id: str, model_name: str, config: dict):
    """Run YOLO pre-annotation on dataset items with server-stored images."""
    try:
        logger.info("Running AI pre-annotation", dataset_id=dataset_id, model=model_name)
        count = _run_async(_prelabel_dataset(dataset_id, model_name, config))
        logger.info("AI pre-annotation complete", dataset_id=dataset_id, items=count)
        return {"items": count}
    except Exception as exc:
        logger.error("AI pre-annotation failed", dataset_id=dataset_id, error=str(exc))
        raise self.retry(exc=exc, countdown=120) from exc


def _run_async(coro):
    if sys.platform == "win32":
        loop = asyncio.SelectorEventLoop(selectors.SelectSelector())
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(coro)
        finally:
            loop.close()
    return asyncio.run(coro)


async def _prelabel_dataset(dataset_id: str, model_name: str, config: dict) -> int:
    from sqlalchemy import select

    from app.database.connection import AsyncSessionLocal
    from app.models.annotation import Annotation
    from app.models.annotation_object import AnnotationObject
    from app.models.dataset_item import DatasetItem
    from app.repositories.annotation_repo import AnnotationRepository
    from app.repositories.dataset_repo import DatasetItemRepository
    from app.services.inference_loader import detection_module
    from app.services.storage_service import LocalStorageBackend, get_storage_backend

    mod = detection_module()
    if not mod.ml_available():
        raise RuntimeError("ML stack not installed")

    output = config.get("output", "bbox")
    confidence = float(config.get("confidence", 0.25))
    folder = config.get("folder")
    skip_existing = bool(config.get("skip_existing", True))
    limit = int(config.get("limit", 100))
    user_id = uuid.UUID(config["user_id"])

    backend = get_storage_backend()
    if not isinstance(backend, LocalStorageBackend):
        raise RuntimeError("Batch pre-label requires server-local storage (not browser-only datasets)")

    processed = 0
    async with AsyncSessionLocal() as db:
        repo = DatasetItemRepository(db)
        ann_repo = AnnotationRepository(db)
        items = await repo.list_index(uuid.UUID(dataset_id), folder=folder, recursive=True, limit=limit)

        for item in items:
            if processed >= limit:
                break
            if skip_existing:
                existing = await ann_repo.get_latest_for_item(item.id)
                if existing and existing.objects:
                    continue

            src = backend.resolve_local_path(item.storage_path)
            if not src.exists():
                logger.warning("Skipping item — image not on server", item_id=str(item.id))
                continue

            raw = src.read_bytes()
            result = mod.detect_objects(
                raw,
                model_id=model_name,
                output=output,
                confidence=confidence,
            )
            objects = result.get("objects") or []
            if not objects:
                continue

            version = await ann_repo.get_next_version(item.id, user_id)
            annotation = Annotation(
                item_id=item.id,
                annotator_id=user_id,
                version=version,
                meta={"source": "ai_prelabel", "model": model_name, "engine": result.get("engine")},
            )
            annotation = await ann_repo.create(annotation)

            for obj in objects:
                db.add(
                    AnnotationObject(
                        annotation_id=annotation.id,
                        class_name=obj["class_name"],
                        tool_type=obj["tool_type"],
                        geometry=obj["geometry"],
                        attributes={"source": "ai_prelabel", "confidence": obj.get("confidence")},
                        confidence=obj.get("confidence"),
                    )
                )
            await db.flush()
            processed += 1

        await db.commit()
    return processed
