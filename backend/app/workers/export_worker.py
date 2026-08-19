"""Export Celery worker."""
import structlog
from app.workers.celery_app import celery_app

logger = structlog.get_logger(__name__)

@celery_app.task(name="app.workers.export_worker.run_export_task", bind=True, max_retries=2)
def run_export_task(self, export_job_id: str):
    """Run dataset export in background."""
    try:
        logger.info("Running export", job_id=export_job_id)
        # TODO: implement with exporters/
        pass
    except Exception as exc:
        logger.error("Export failed", job_id=export_job_id, error=str(exc))
        raise self.retry(exc=exc, countdown=60)
