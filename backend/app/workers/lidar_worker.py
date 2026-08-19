"""LiDAR/Point cloud processing Celery worker."""
import structlog
from app.workers.celery_app import celery_app
from app.workers.image_worker import _update_item_status

logger = structlog.get_logger(__name__)

@celery_app.task(name="app.workers.lidar_worker.process_lidar_task", bind=True, max_retries=2)
def process_lidar_task(self, item_id: str, storage_path: str):
    """Convert, downsample, and create octree LOD for a point cloud."""
    try:
        logger.info("Processing LiDAR", item_id=item_id)
        # TODO Phase 7: implement with Open3D
        _update_item_status(item_id, "ready")
    except Exception as exc:
        _update_item_status(item_id, "error")
        raise self.retry(exc=exc, countdown=60)
