"""analytics API endpoints — stub (full implementation in subsequent phases)."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def list_analytics():
    return {"resource": "analytics", "items": [], "total": 0}
