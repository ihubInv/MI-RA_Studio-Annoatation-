"""qa API endpoints — stub (full implementation in subsequent phases)."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def list_qa():
    return {"resource": "qa", "items": [], "total": 0}
