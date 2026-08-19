"""admin API endpoints — stub (full implementation in subsequent phases)."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def list_admin():
    return {"resource": "admin", "items": [], "total": 0}
