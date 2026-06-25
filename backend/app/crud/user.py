from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


async def get(db: AsyncSession, user_id: int) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_by_email(db: AsyncSession, email: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_multi(db: AsyncSession, skip: int = 0, limit: int = 100) -> list[User]:
    result = await db.execute(select(User).offset(skip).limit(limit))
    return list(result.scalars().all())


async def create(db: AsyncSession, obj_in: UserCreate) -> User:
    user = User(
        email=obj_in.email,
        hashed_password=hash_password(obj_in.password),
        full_name=obj_in.full_name,
        department=obj_in.department,
        role=obj_in.role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update(db: AsyncSession, db_obj: User, obj_in: UserUpdate) -> User:
    data = obj_in.model_dump(exclude_unset=True)
    if "password" in data:
        db_obj.hashed_password = hash_password(data.pop("password"))
    for field, value in data.items():
        setattr(db_obj, field, value)
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


async def authenticate(db: AsyncSession, email: str, password: str) -> Optional[User]:
    user = await get_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password):
        return None
    return user
