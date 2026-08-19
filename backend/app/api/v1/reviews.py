"""Reviews API — submit, approve, reject."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select

from app.api.deps import CurrentUser, DB
from app.models.annotation import Annotation
from app.models.review import Review
from app.repositories.annotation_repo import AnnotationRepository
from app.services.audit_service import log_action
from app.services.item_status import sync_item_status

router = APIRouter()


class ReviewCreate(BaseModel):
    annotation_id: uuid.UUID
    status: str = "in_review"
    comment: str | None = None


@router.get("/")
async def list_reviews(
    current_user: CurrentUser,
    db: DB,
    item_id: uuid.UUID | None = Query(None),
    annotation_id: uuid.UUID | None = Query(None),
):
    stmt = select(Review).order_by(Review.created_at.desc()).limit(200)
    if annotation_id:
        stmt = select(Review).where(Review.annotation_id == annotation_id).order_by(Review.created_at.desc())
    elif item_id:
        anns = (await db.execute(select(Annotation.id).where(Annotation.item_id == item_id))).scalars().all()
        stmt = select(Review).where(Review.annotation_id.in_(anns or [uuid.uuid4()])).order_by(Review.created_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return {
        "resource": "reviews",
        "total": len(rows),
        "items": [
            {
                "id": str(r.id),
                "annotation_id": str(r.annotation_id),
                "reviewer_id": str(r.reviewer_id),
                "status": r.status,
                "comment": r.comment,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ],
    }


@router.post("/")
async def create_review(payload: ReviewCreate, current_user: CurrentUser, db: DB):
    repo = AnnotationRepository(db)
    ann = await repo.get_with_objects(payload.annotation_id)
    if not ann:
        raise HTTPException(status_code=404, detail="Annotation not found")
    review = Review(
        annotation_id=payload.annotation_id,
        reviewer_id=current_user.id,
        status=payload.status,
        comment=payload.comment,
    )
    db.add(review)
    if payload.status == "in_review":
        await repo.update(ann, status="in_review")
    await db.flush()
    await log_action(db, current_user.id, "create_review", "annotation", str(ann.id))
    return {"id": str(review.id), "status": review.status}


@router.post("/{review_id}/approve")
async def approve_review(review_id: uuid.UUID, current_user: CurrentUser, db: DB):
    review = await db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.status = "approved"
    repo = AnnotationRepository(db)
    ann = await repo.get_with_objects(review.annotation_id)
    if ann:
        await repo.update(ann, status="approved")
        await sync_item_status(db, ann.item_id, ann, len(ann.objects or []))
    await log_action(db, current_user.id, "approve_review", "annotation", str(review.annotation_id))
    return {"id": str(review.id), "status": "approved"}


@router.post("/{review_id}/reject")
async def reject_review(review_id: uuid.UUID, current_user: CurrentUser, db: DB):
    review = await db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.status = "rejected"
    repo = AnnotationRepository(db)
    ann = await repo.get_with_objects(review.annotation_id)
    if ann:
        await repo.update(ann, status="rejected")
        await sync_item_status(db, ann.item_id, ann, len(ann.objects or []))
    await log_action(db, current_user.id, "reject_review", "annotation", str(review.annotation_id))
    return {"id": str(review.id), "status": "rejected"}
