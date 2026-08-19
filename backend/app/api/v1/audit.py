"""audit API endpoints — stub (full implementation in subsequent phases)."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def list_audit():
    return {"resource": "audit", "items": [], "total": 0}
