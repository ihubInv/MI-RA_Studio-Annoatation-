"""Image processing Celery worker."""
import asyncio
import selectors
import sys

import structlog
from app.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


@celery_app.task(name="app.workers.image_worker.process_image_task", bind=True, max_retries=3)
def process_image_task(self, item_id: str, storage_path: str):
    try:
        logger.info("Processing image", item_id=item_id, path=storage_path)
        _process(item_id, storage_path)
        logger.info("Image processed", item_id=item_id)
    except Exception as exc:
        logger.error("Image processing failed", item_id=item_id, error=str(exc))
        _update_item(item_id, status="error")
        raise self.retry(exc=exc, countdown=30)


def _process(item_id: str, storage_path: str) -> None:
    from app.models.dataset_item import ItemStatus
    from app.services.image_processing import process_local_image

    result = process_local_image(storage_path)
    _update_item(
        item_id,
        status=ItemStatus.READY,
        width=result.width,
        height=result.height,
        thumbnail_path=result.thumbnail_path,
        meta=result.metadata,
    )


def _update_item(item_id: str, **fields):
    from sqlalchemy import select
    from app.database.connection import AsyncSessionLocal
    from app.models.dataset_item import DatasetItem

    async def _update():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(DatasetItem).where(DatasetItem.id == item_id))
            item = result.scalar_one_or_none()
            if item:
                for key, value in fields.items():
                    setattr(item, key, value)
                await db.commit()

    if sys.platform == "win32":
        loop = asyncio.SelectorEventLoop(selectors.SelectSelector())
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(_update())
        finally:
            loop.close()
    else:
        asyncio.run(_update())
