from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, schemas
from app.api.deps import get_current_user, get_db, require_roles
from app.models.review import ReviewStatus
from app.models.user import User, UserRole

router = APIRouter()


@router.get("", response_model=list[schemas.ReviewOut])
async def list_reviews(
    status: Optional[ReviewStatus] = None,
    project_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # CEO and managers see all reviews; employees see only their own submissions.
    if current_user.role in (UserRole.ceo, UserRole.manager):
        return await crud.review.get_multi(
            db, skip=skip, limit=limit, status=status, project_id=project_id
        )
    reviews = await crud.review.get_by_submitter(db, current_user.id)
    if project_id is not None:
        reviews = [r for r in reviews if r.project_id == project_id]
    if status is not None:
        reviews = [r for r in reviews if r.status == status]
    return reviews


@router.post("", response_model=schemas.ReviewOut, status_code=201)
async def create_review(
    review_in: schemas.ReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await crud.review.create(db, review_in, submitter_id=current_user.id)


@router.get("/{review_id}", response_model=schemas.ReviewOut)
async def get_review(
    review_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = await crud.review.get(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return review


@router.patch("/{review_id}", response_model=schemas.ReviewOut)
async def update_review(
    review_id: int,
    review_in: schemas.ReviewUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = await crud.review.get(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    # Only CEO/manager may change decision fields (status / reviewer assignment).
    is_decision = review_in.status is not None or review_in.reviewer_id is not None
    if is_decision and current_user.role not in (UserRole.ceo, UserRole.manager):
        raise HTTPException(status_code=403, detail="Only reviewers can change status")
    if not is_decision and review.submitter_id != current_user.id and current_user.role not in (
        UserRole.ceo,
        UserRole.manager,
    ):
        raise HTTPException(status_code=403, detail="Not your review")
    return await crud.review.update(db, review, review_in)


@router.get("/{review_id}/comments", response_model=list[schemas.CommentOut])
async def list_comments(
    review_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = await crud.review.get(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return await crud.review.get_comments(db, review_id)


@router.post("/{review_id}/comments", response_model=schemas.CommentOut, status_code=201)
async def add_comment(
    review_id: int,
    comment_in: schemas.CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    review = await crud.review.get(db, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    return await crud.review.add_comment(db, review_id, comment_in, author_id=current_user.id)
