"""organizations API endpoints — stub (full implementation in subsequent phases)."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def list_organizations():
    return {"resource": "organizations", "items": [], "total": 0}
