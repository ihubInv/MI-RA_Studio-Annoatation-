"""ontology API endpoints — stub (full implementation in subsequent phases)."""
from fastapi import APIRouter
router = APIRouter()

@router.get("/")
async def list_ontology():
    return {"resource": "ontology", "items": [], "total": 0}
