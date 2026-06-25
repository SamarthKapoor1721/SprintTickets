from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict

from app.models.review import ReviewPriority, ReviewStatus
from app.schemas.user import UserOut


class CommentBase(BaseModel):
    content: str


class CommentCreate(CommentBase):
    pass


class CommentOut(CommentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    review_request_id: int
    author_id: Optional[int] = None
    author: Optional[UserOut] = None
    created_at: Optional[datetime] = None


class ReviewBase(BaseModel):
    title: str
    summary: Optional[str] = None
    objective: Optional[str] = None
    priority: ReviewPriority = ReviewPriority.medium
    review_type: Optional[str] = None
    website_url: Optional[str] = None
    github_repo: Optional[str] = None
    figma_link: Optional[str] = None
    documentation_link: Optional[str] = None
    tech_details: Optional[Any] = None
    project_id: Optional[int] = None


class ReviewCreate(ReviewBase):
    pass


class ReviewUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    objective: Optional[str] = None
    status: Optional[ReviewStatus] = None
    priority: Optional[ReviewPriority] = None
    reviewer_id: Optional[int] = None
    website_url: Optional[str] = None
    github_repo: Optional[str] = None
    figma_link: Optional[str] = None
    documentation_link: Optional[str] = None
    tech_details: Optional[Any] = None


class ReviewOut(ReviewBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: ReviewStatus
    submitter_id: Optional[int] = None
    reviewer_id: Optional[int] = None
    submitter: Optional[UserOut] = None
    reviewer: Optional[UserOut] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
