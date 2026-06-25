from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, schemas
from app.api.deps import get_db, require_roles
from app.models.user import User, UserRole

router = APIRouter()


@router.get("", response_model=list[schemas.UserOut])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ceo, UserRole.manager)),
):
    return await crud.user.get_multi(db, skip=skip, limit=limit)
