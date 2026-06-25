from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.review import Comment, ReviewRequest, ReviewStatus
from app.schemas.review import CommentCreate, ReviewCreate, ReviewUpdate


async def get(db: AsyncSession, review_id: int) -> Optional[ReviewRequest]:
    result = await db.execute(select(ReviewRequest).where(ReviewRequest.id == review_id))
    return result.scalar_one_or_none()


async def get_multi(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    status: Optional[ReviewStatus] = None,
    project_id: Optional[int] = None,
) -> list[ReviewRequest]:
    stmt = select(ReviewRequest)
    if status is not None:
        stmt = stmt.where(ReviewRequest.status == status)
    if project_id is not None:
        stmt = stmt.where(ReviewRequest.project_id == project_id)
    stmt = stmt.order_by(ReviewRequest.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_by_submitter(db: AsyncSession, submitter_id: int) -> list[ReviewRequest]:
    result = await db.execute(
        select(ReviewRequest)
        .where(ReviewRequest.submitter_id == submitter_id)
        .order_by(ReviewRequest.created_at.desc())
    )
    return list(result.scalars().all())


async def create(db: AsyncSession, obj_in: ReviewCreate, submitter_id: int) -> ReviewRequest:
    review = ReviewRequest(**obj_in.model_dump(), submitter_id=submitter_id)
    db.add(review)
    await db.commit()
    # Re-fetch so selectin relationships (submitter/reviewer) are loaded for serialization.
    return await get(db, review.id)


async def update(db: AsyncSession, db_obj: ReviewRequest, obj_in: ReviewUpdate) -> ReviewRequest:
    for field, value in obj_in.model_dump(exclude_unset=True).items():
        setattr(db_obj, field, value)
    db.add(db_obj)
    await db.commit()
    # Reload columns (e.g. the server-side updated_at) and then the relationships,
    # so the response reflects a newly assigned reviewer.
    await db.refresh(db_obj)
    await db.refresh(db_obj, attribute_names=["submitter", "reviewer"])
    return db_obj


async def get_comments(db: AsyncSession, review_id: int) -> list[Comment]:
    result = await db.execute(
        select(Comment)
        .where(Comment.review_request_id == review_id)
        .order_by(Comment.created_at.asc())
    )
    return list(result.scalars().all())


async def add_comment(
    db: AsyncSession, review_id: int, obj_in: CommentCreate, author_id: int
) -> Comment:
    comment = Comment(
        content=obj_in.content, review_request_id=review_id, author_id=author_id
    )
    db.add(comment)
    await db.commit()
    # Re-fetch so the selectin "author" relationship is loaded for serialization.
    result = await db.execute(select(Comment).where(Comment.id == comment.id))
    return result.scalar_one()
