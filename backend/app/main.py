"""
MI-RA Studio — FastAPI Application Entry Point
"""
import asyncio
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse

from app.api.v1.router import api_router
from app.config import settings
from app.database.connection import engine, Base
from app.middleware.request_logger import RequestLoggerMiddleware

logger = structlog.get_logger(__name__)


def _ensure_dataset_item_path_columns(sync_conn) -> None:
    """create_all will not ALTER existing tables — add path columns if missing."""
    from sqlalchemy import text

    sync_conn.execute(text("ALTER TABLE dataset_items ADD COLUMN IF NOT EXISTS relative_path VARCHAR(2000)"))
    sync_conn.execute(text("ALTER TABLE dataset_items ADD COLUMN IF NOT EXISTS parent_folder VARCHAR(1500)"))
    sync_conn.execute(text("CREATE INDEX IF NOT EXISTS ix_dataset_items_relative_path ON dataset_items (relative_path)"))
    sync_conn.execute(text("CREATE INDEX IF NOT EXISTS ix_dataset_items_parent_folder ON dataset_items (parent_folder)"))
    sync_conn.execute(text("ALTER TABLE datasets ADD COLUMN IF NOT EXISTS storage_mode VARCHAR(20) DEFAULT 'server'"))
    sync_conn.execute(
        text(
            """
            UPDATE dataset_items
            SET relative_path = original_filename
            WHERE relative_path IS NULL OR relative_path = ''
            """
        )
    )
    sync_conn.execute(
        text(
            """
            UPDATE dataset_items
            SET parent_folder = ''
            WHERE parent_folder IS NULL
            """
        )
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown hooks."""
    logger.info("MI-RA Studio starting up", version=settings.APP_VERSION)
    # Create tables (idempotent – Alembic handles migrations)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_ensure_dataset_item_path_columns)
    logger.info("Database tables verified")
    yield
    logger.info("MI-RA Studio shutting down")


app = FastAPI(
    title="MI-RA Studio API",
    description="Universal Multimodal Annotation & Dataset Intelligence Platform — MI-RA Lab",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

# ── Middleware ────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(RequestLoggerMiddleware)

# ── Routes ───────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health_check():
    return {
        "status": "ok",
        "service": "MI-RA Studio",
        "version": settings.APP_VERSION,
        "features": ["zip-folders"],
    }


@app.get("/", tags=["system"])
async def root():
    return {"message": "MI-RA Studio API", "docs": "/docs"}
