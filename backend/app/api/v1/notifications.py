"""notifications API endpoints — stub (full implementation in subsequent phases)."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def list_notifications():
    return {"resource": "notifications", "items": [], "total": 0}
