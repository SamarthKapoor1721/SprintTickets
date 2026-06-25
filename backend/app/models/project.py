from sqlalchemy import Column, Integer, String, ForeignKey, Enum, DateTime, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base_class import Base
import enum

class ProjectStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    on_hold = "on_hold"

# Many-to-many: which users belong to which projects.
project_members = Table(
    "project_members",
    Base.metadata,
    Column("project_id", Integer, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)

class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    description = Column(String)
    department = Column(String)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.active)
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", backref="projects", lazy="selectin")

    members = relationship("User", secondary=project_members, lazy="selectin")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
