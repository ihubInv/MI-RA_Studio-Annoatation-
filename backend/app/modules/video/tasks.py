"""Schedule video processing after ingest."""
from __future__ import annotations

import structlog
from concurrent.futures import ThreadPoolExecutor

logger = structlog.get_logger(__name__)
_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="video-process")


def run_video_processing(item_id: str, storage_path: str) -> None:
    from app.modules.video.process import process_video_file, resolve_local_video_path
    from app.workers.video_worker import _update_video_item

    try:
        local_path = resolve_local_video_path(storage_path)
        from sqlalchemy import select
        from app.database.connection import AsyncSessionLocal
        from app.models.dataset_item import DatasetItem, ItemStatus
        import asyncio
        import sys
        import selectors

        async def _load():
            async with AsyncSessionLocal() as db:
                result = await db.execute(select(DatasetItem).where(DatasetItem.id == item_id))
                return result.scalar_one_or_none()

        if sys.platform == "win32":
            loop = asyncio.SelectorEventLoop(selectors.SelectSelector())
            asyncio.set_event_loop(loop)
            try:
                item = loop.run_until_complete(_load())
            finally:
                loop.close()
        else:
            item = asyncio.run(_load())

        if not item:
            logger.warning("Video item not found for processing", item_id=item_id)
            return

        result = process_video_file(
            local_path=local_path,
            dataset_id=str(item.dataset_id),
            relative_path=item.relative_path or item.filename,
            file_size_bytes=item.file_size_bytes or local_path.stat().st_size,
        )
        _update_video_item(
            item_id,
            status=ItemStatus.READY,
            width=result.width,
            height=result.height,
            fps=result.fps,
            duration_seconds=result.duration_seconds,
            frame_count=result.frame_count,
            thumbnail_path=result.thumbnail_path,
            preview_path=result.preview_path,
            meta=result.meta,
        )
        logger.info("Video processed", item_id=item_id, proxies=list(result.proxies.keys()))
    except Exception as exc:
        logger.error("Video processing failed", item_id=item_id, error=str(exc))
        from app.models.dataset_item import ItemStatus
        from app.workers.video_worker import _update_video_item

        _update_video_item(item_id, status=ItemStatus.ERROR, meta={"processing_error": str(exc)})
        raise


def schedule_video_processing(item_id: str, storage_path: str) -> None:
    try:
        from app.workers.video_worker import process_video_task

        process_video_task.delay(item_id, storage_path)
        logger.info("Queued video processing", item_id=item_id)
        return
    except Exception as exc:
        logger.warning("Celery unavailable, processing in thread pool", item_id=item_id, error=str(exc))

    _executor.submit(run_video_processing, item_id, storage_path)
