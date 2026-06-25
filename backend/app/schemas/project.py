from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict

from app.models.project import ProjectStatus
from app.schemas.user import UserOut


class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    department: Optional[str] = None
    status: ProjectStatus = ProjectStatus.active


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    department: Optional[str] = None
    status: Optional[ProjectStatus] = None


class ProjectOut(ProjectBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    owner_id: Optional[int] = None
    owner: Optional[UserOut] = None
    members: List[UserOut] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ProjectMemberAdd(BaseModel):
    user_id: int
