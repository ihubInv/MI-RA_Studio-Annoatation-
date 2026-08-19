"""Celery application factory."""
from celery import Celery
from app.config import settings

celery_app = Celery(
    "mira_studio",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.workers.image_worker",
        "app.workers.video_worker",
        "app.workers.audio_worker",
        "app.workers.lidar_worker",
        "app.workers.embedding_worker",
        "app.workers.export_worker",
        "app.workers.ai_worker",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.workers.image_worker.*": {"queue": "image"},
        "app.workers.video_worker.*": {"queue": "video"},
        "app.workers.audio_worker.*": {"queue": "audio"},
        "app.workers.lidar_worker.*": {"queue": "lidar"},
        "app.workers.embedding_worker.*": {"queue": "embeddings"},
        "app.workers.export_worker.*": {"queue": "export"},
        "app.workers.ai_worker.*": {"queue": "ai"},
    },
)
