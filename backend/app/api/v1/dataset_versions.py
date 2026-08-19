"""dataset_versions API endpoints — stub (full implementation in subsequent phases)."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def list_dataset_versions():
    return {"resource": "dataset_versions", "items": [], "total": 0}
