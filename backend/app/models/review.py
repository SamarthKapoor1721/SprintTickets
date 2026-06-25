from sqlalchemy import Column, Integer, String, ForeignKey, Enum, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import enum

class ReviewStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"
    needs_changes = "needs_changes"

class ReviewPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"

class ReviewRequest(Base):
    __tablename__ = "review_requests"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    summary = Column(Text)
    objective = Column(Text)
    status = Column(Enum(ReviewStatus), default=ReviewStatus.pending)
    priority = Column(Enum(ReviewPriority), default=ReviewPriority.medium)
    review_type = Column(String)
    
    website_url = Column(String)
    github_repo = Column(String)
    figma_link = Column(String)
    documentation_link = Column(String)
    
    # JSON field for specialized tech review details
    tech_details = Column(JSON, nullable=True) 
    
    project_id = Column(Integer, ForeignKey("projects.id"))
    project = relationship("Project", backref="review_requests")
    
    submitter_id = Column(Integer, ForeignKey("users.id"))
    submitter = relationship("User", foreign_keys=[submitter_id], lazy="selectin")

    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewer = relationship("User", foreign_keys=[reviewer_id], lazy="selectin")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    
    review_request_id = Column(Integer, ForeignKey("review_requests.id"))
    review_request = relationship("ReviewRequest", backref="comments")
    
    author_id = Column(Integer, ForeignKey("users.id"))
    author = relationship("User", foreign_keys=[author_id], lazy="selectin")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
