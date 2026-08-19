"""models API endpoints — stub (full implementation in subsequent phases)."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def list_models():
    return {"resource": "models", "items": [], "total": 0}
