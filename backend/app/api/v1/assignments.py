"""assignments API endpoints — stub (full implementation in subsequent phases)."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def list_assignments():
    return {"resource": "assignments", "items": [], "total": 0}
