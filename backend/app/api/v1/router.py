"""API v1 — aggregated router."""
from fastapi import APIRouter

from app.api.v1 import (
    auth, users, organizations, projects,
    datasets, dataset_items, dataset_versions,
    schemas, ontology, tasks, assignments,
    annotations, reviews, qa, models,
    predictions, embeddings, analytics,
    exports, uploads, media, audit, notifications, admin, inference, video,
)

api_router = APIRouter()

api_router.include_router(auth.router,           prefix="/auth",              tags=["Authentication"])
api_router.include_router(users.router,          prefix="/users",             tags=["Users"])
api_router.include_router(organizations.router,  prefix="/organizations",     tags=["Organizations"])
api_router.include_router(projects.router,       prefix="/projects",          tags=["Projects"])
api_router.include_router(datasets.router,       prefix="/datasets",          tags=["Datasets"])
api_router.include_router(dataset_items.router,  prefix="/dataset-items",     tags=["Dataset Items"])
api_router.include_router(dataset_versions.router, prefix="/dataset-versions", tags=["Dataset Versions"])
api_router.include_router(schemas.router,        prefix="/schemas",           tags=["Image · Label Schemas"])
api_router.include_router(ontology.router,       prefix="/ontology",          tags=["Ontology"])
api_router.include_router(tasks.router,          prefix="/tasks",             tags=["Tasks"])
api_router.include_router(assignments.router,    prefix="/assignments",       tags=["Assignments"])
api_router.include_router(annotations.router,    prefix="/annotations",       tags=["Annotations"])
api_router.include_router(reviews.router,        prefix="/reviews",           tags=["Reviews"])
api_router.include_router(qa.router,             prefix="/qa",                tags=["Quality Assurance"])
api_router.include_router(models.router,         prefix="/models",            tags=["ML Models"])
api_router.include_router(inference.router,      prefix="/inference",         tags=["Image · AI Inference"])
api_router.include_router(predictions.router,    prefix="/predictions",       tags=["Predictions"])
api_router.include_router(embeddings.router,     prefix="/embeddings",        tags=["Embeddings"])
api_router.include_router(analytics.router,      prefix="/analytics",         tags=["Analytics"])
api_router.include_router(exports.router,        prefix="/exports",           tags=["Image · Exports"])
api_router.include_router(uploads.router,        prefix="/uploads",           tags=["Uploads"])
api_router.include_router(video.router,          prefix="/video",             tags=["Video"])
api_router.include_router(media.router,          prefix="/media",             tags=["Media"])
api_router.include_router(audit.router,          prefix="/audit",             tags=["Audit Logs"])
api_router.include_router(notifications.router,  prefix="/notifications",     tags=["Notifications"])
api_router.include_router(admin.router,          prefix="/admin",             tags=["Administration"])
