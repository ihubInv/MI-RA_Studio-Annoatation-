"""Storage backends — local filesystem (default), MinIO, Supabase Storage."""
from __future__ import annotations

from abc import ABC, abstractmethod
from io import BytesIO
from pathlib import Path
from typing import Optional
from urllib.parse import quote

import httpx
from minio import Minio
from minio.error import S3Error

from app.config import settings


class StorageBackend(ABC):
    @abstractmethod
    async def upload_bytes(self, data: bytes, object_name: str, content_type: str) -> str:
        ...

    @abstractmethod
    def get_public_url(self, object_name: str) -> str:
        ...

    @abstractmethod
    def delete_object(self, object_name: str) -> None:
        ...

    @abstractmethod
    def object_exists(self, object_name: str) -> bool:
        ...

    def get_presigned_url(self, object_name: str, expires_seconds: int = 3600) -> str:
        return self.get_public_url(object_name)


class LocalStorageBackend(StorageBackend):
    def __init__(self, root: str | Path | None = None):
        self._root = Path(root or settings.LOCAL_STORAGE_ROOT).resolve()
        self._root.mkdir(parents=True, exist_ok=True)

    def _path_for(self, object_name: str) -> Path:
        safe_name = object_name.replace("\\", "/").lstrip("/")
        return self._root / safe_name

    async def upload_bytes(self, data: bytes, object_name: str, content_type: str) -> str:
        import asyncio

        path = self._path_for(object_name)

        def _write() -> None:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)

        await asyncio.to_thread(_write)
        return object_name

    def get_public_url(self, object_name: str) -> str:
        encoded = quote(object_name.replace("\\", "/").lstrip("/"), safe="/")
        return f"{settings.STORAGE_BASE_URL.rstrip('/')}/{encoded}"

    def delete_object(self, object_name: str) -> None:
        path = self._path_for(object_name)
        if path.exists():
            path.unlink()

    def object_exists(self, object_name: str) -> bool:
        return self._path_for(object_name).exists()

    def resolve_local_path(self, object_name: str) -> Path:
        return self._path_for(object_name)


class MinioStorageBackend(StorageBackend):
    def __init__(self):
        self._client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        self._bucket = settings.MINIO_BUCKET
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        try:
            if not self._client.bucket_exists(self._bucket):
                self._client.make_bucket(self._bucket)
        except S3Error:
            pass

    async def upload_bytes(self, data: bytes, object_name: str, content_type: str) -> str:
        stream = BytesIO(data)
        self._client.put_object(
            self._bucket,
            object_name,
            stream,
            length=len(data),
            content_type=content_type,
        )
        return object_name

    def get_public_url(self, object_name: str) -> str:
        return f"{settings.STORAGE_BASE_URL.rstrip('/')}/{object_name}"

    def get_presigned_url(self, object_name: str, expires_seconds: int = 3600) -> str:
        from datetime import timedelta

        return self._client.presigned_get_object(
            self._bucket,
            object_name,
            expires=timedelta(seconds=expires_seconds),
        )

    def delete_object(self, object_name: str) -> None:
        self._client.remove_object(self._bucket, object_name)

    def object_exists(self, object_name: str) -> bool:
        try:
            self._client.stat_object(self._bucket, object_name)
            return True
        except S3Error:
            return False


class SupabaseStorageBackend(StorageBackend):
    """Upload/download via Supabase Storage REST API."""

    def __init__(self):
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for supabase storage")
        self._base = settings.SUPABASE_URL.rstrip("/")
        self._bucket = settings.SUPABASE_STORAGE_BUCKET
        self._headers = {
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
        }

    def _object_url(self, object_name: str) -> str:
        safe = object_name.replace("\\", "/").lstrip("/")
        return f"{self._base}/storage/v1/object/{self._bucket}/{safe}"

    async def upload_bytes(self, data: bytes, object_name: str, content_type: str) -> str:
        url = self._object_url(object_name)
        headers = {**self._headers, "Content-Type": content_type, "x-upsert": "true"}
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, content=data, headers=headers)
            response.raise_for_status()
        return object_name

    def get_public_url(self, object_name: str) -> str:
        safe = quote(object_name.replace("\\", "/").lstrip("/"), safe="/")
        return f"{self._base}/storage/v1/object/public/{self._bucket}/{safe}"

    def delete_object(self, object_name: str) -> None:
        import asyncio

        async def _delete():
            url = self._object_url(object_name)
            async with httpx.AsyncClient(timeout=60) as client:
                response = await client.delete(url, headers=self._headers)
                response.raise_for_status()

        asyncio.run(_delete())

    def object_exists(self, object_name: str) -> bool:
        import asyncio

        async def _exists() -> bool:
            url = self._object_url(object_name)
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.head(url, headers=self._headers)
                return response.status_code == 200

        return asyncio.run(_exists())


_backend: Optional[StorageBackend] = None


def get_storage_backend() -> StorageBackend:
    global _backend
    if _backend is None:
        if settings.STORAGE_BACKEND == "minio":
            _backend = MinioStorageBackend()
        elif settings.STORAGE_BACKEND == "supabase":
            _backend = SupabaseStorageBackend()
        else:
            _backend = LocalStorageBackend()
    return _backend


class StorageService:
    """Facade used by API routes and workers."""

    def __init__(self):
        self._backend = get_storage_backend()

    async def upload_bytes(self, data: bytes, object_name: str, content_type: str) -> str:
        return await self._backend.upload_bytes(data, object_name, content_type)

    def get_presigned_url(self, object_name: str, expires_seconds: int = 3600) -> str:
        return self._backend.get_presigned_url(object_name, expires_seconds)

    def get_public_url(self, object_name: str) -> str:
        return self._backend.get_public_url(object_name)

    def delete_object(self, object_name: str) -> None:
        self._backend.delete_object(object_name)

    def object_exists(self, object_name: str) -> bool:
        return self._backend.object_exists(object_name)

    @property
    def is_local(self) -> bool:
        return isinstance(self._backend, LocalStorageBackend)

    def resolve_local_path(self, object_name: str) -> Path | None:
        if isinstance(self._backend, LocalStorageBackend):
            return self._backend.resolve_local_path(object_name)
        return None
