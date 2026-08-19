"""users API endpoints — stub (full implementation in subsequent phases)."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def list_users():
    return {"resource": "users", "items": [], "total": 0}
