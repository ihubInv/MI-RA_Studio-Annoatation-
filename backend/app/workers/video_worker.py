"""Video processing Celery worker."""
import structlog
from app.workers.celery_app import celery_app
from app.workers.image_worker import _update_item_status

logger = structlog.get_logger(__name__)

@celery_app.task(name="app.workers.video_worker.process_video_task", bind=True, max_retries=3)
def process_video_task(self, item_id: str, storage_path: str):
    """Extract frames, generate thumbnail, detect FPS/duration."""
    try:
        logger.info("Processing video", item_id=item_id)
        # TODO Phase 3: implement with FFmpeg
        _update_item_status(item_id, "ready")
    except Exception as exc:
        _update_item_status(item_id, "error")
        raise self.retry(exc=exc, countdown=60)
