"""Video processing Celery worker."""
from __future__ import annotations

import asyncio
import selectors
import sys
import uuid

import structlog
from sqlalchemy import select

from app.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)


def _update_video_item(item_id: str, **fields):
    from app.database.connection import AsyncSessionLocal
    from app.models.dataset_item import DatasetItem

    async def _update():
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(DatasetItem).where(DatasetItem.id == uuid.UUID(item_id)))
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


@celery_app.task(name="app.workers.video_worker.process_video_task", bind=True, max_retries=3)
def process_video_task(self, item_id: str, storage_path: str):
    """Extract metadata, thumbnails, proxies, and frame index."""
    try:
        from app.modules.video.tasks import run_video_processing

        logger.info("Processing video", item_id=item_id)
        run_video_processing(item_id, storage_path)
    except Exception as exc:
        from app.models.dataset_item import ItemStatus

        _update_video_item(item_id, status=ItemStatus.ERROR, meta={"processing_error": str(exc)})
        raise self.retry(exc=exc, countdown=60) from exc
