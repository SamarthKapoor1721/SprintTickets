from typing import Optional

from sqlalchemy import delete, insert, select
from sqlalchemy import update as sql_update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project, project_members
from app.models.review import ReviewRequest
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectUpdate


async def get(db: AsyncSession, project_id: int) -> Optional[Project]:
    result = await db.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()


async def get_multi(db: AsyncSession, skip: int = 0, limit: int = 100) -> list[Project]:
    result = await db.execute(
        select(Project).order_by(Project.created_at.desc()).offset(skip).limit(limit)
    )
    return list(result.scalars().all())


async def get_by_owner(db: AsyncSession, owner_id: int) -> list[Project]:
    result = await db.execute(
        select(Project).where(Project.owner_id == owner_id).order_by(Project.created_at.desc())
    )
    return list(result.scalars().all())


async def create(db: AsyncSession, obj_in: ProjectCreate, owner_id: int) -> Project:
    project = Project(**obj_in.model_dump(), owner_id=owner_id)
    db.add(project)
    await db.commit()
    # Reload columns + relationships (owner/members) for serialization.
    await db.refresh(project)
    await db.refresh(project, attribute_names=["owner", "members"])
    return project


async def update(db: AsyncSession, db_obj: Project, obj_in: ProjectUpdate) -> Project:
    for field, value in obj_in.model_dump(exclude_unset=True).items():
        setattr(db_obj, field, value)
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    await db.refresh(db_obj, attribute_names=["owner", "members"])
    return db_obj


async def remove(db: AsyncSession, db_obj: Project) -> None:
    # Detach reviews and clear team memberships so the delete is clean
    # regardless of whether SQLite FK enforcement is enabled.
    await db.execute(
        sql_update(ReviewRequest)
        .where(ReviewRequest.project_id == db_obj.id)
        .values(project_id=None)
    )
    await db.execute(
        delete(project_members).where(project_members.c.project_id == db_obj.id)
    )
    await db.delete(db_obj)
    await db.commit()


async def get_members(db: AsyncSession, project_id: int) -> list[User]:
    result = await db.execute(
        select(User)
        .join(project_members, project_members.c.user_id == User.id)
        .where(project_members.c.project_id == project_id)
        .order_by(User.full_name)
    )
    return list(result.scalars().all())


async def is_member(db: AsyncSession, project_id: int, user_id: int) -> bool:
    result = await db.execute(
        select(project_members.c.user_id).where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == user_id,
        )
    )
    return result.first() is not None


async def add_member(db: AsyncSession, project_id: int, user_id: int) -> None:
    if await is_member(db, project_id, user_id):
        return
    await db.execute(insert(project_members).values(project_id=project_id, user_id=user_id))
    await db.commit()


async def remove_member(db: AsyncSession, project_id: int, user_id: int) -> None:
    await db.execute(
        delete(project_members).where(
            project_members.c.project_id == project_id,
            project_members.c.user_id == user_id,
        )
    )
    await db.commit()
