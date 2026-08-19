"""Audio processing Celery worker."""
import structlog
from app.workers.celery_app import celery_app
from app.workers.image_worker import _update_item_status

logger = structlog.get_logger(__name__)

@celery_app.task(name="app.workers.audio_worker.process_audio_task", bind=True, max_retries=3)
def process_audio_task(self, item_id: str, storage_path: str):
    """Generate waveform, extract duration and sample rate."""
    try:
        logger.info("Processing audio", item_id=item_id)
        # TODO Phase 5: implement with librosa
        _update_item_status(item_id, "ready")
    except Exception as exc:
        _update_item_status(item_id, "error")
        raise self.retry(exc=exc, countdown=30)
