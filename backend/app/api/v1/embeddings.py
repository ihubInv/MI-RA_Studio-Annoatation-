"""embeddings API endpoints — stub (full implementation in subsequent phases)."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def list_embeddings():
    return {"resource": "embeddings", "items": [], "total": 0}
