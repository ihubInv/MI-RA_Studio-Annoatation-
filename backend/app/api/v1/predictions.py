"""predictions API endpoints — stub (full implementation in subsequent phases)."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def list_predictions():
    return {"resource": "predictions", "items": [], "total": 0}
