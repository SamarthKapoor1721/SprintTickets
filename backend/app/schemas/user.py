from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    department: Optional[str] = None
    role: UserRole = UserRole.employee


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
