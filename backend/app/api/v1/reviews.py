"""reviews API endpoints — stub (full implementation in subsequent phases)."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def list_reviews():
    return {"resource": "reviews", "items": [], "total": 0}
