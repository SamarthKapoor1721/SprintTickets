from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, schemas
from app.api.deps import get_current_user, get_db, require_roles
from app.models.user import User, UserRole

router = APIRouter()


@router.get("", response_model=list[schemas.ProjectOut])
async def list_projects(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # CEO sees everything; managers/employees see projects they own.
    if current_user.role == UserRole.ceo:
        return await crud.project.get_multi(db, skip=skip, limit=limit)
    return await crud.project.get_by_owner(db, current_user.id)


@router.post("", response_model=schemas.ProjectOut, status_code=201)
async def create_project(
    project_in: schemas.ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ceo, UserRole.manager)),
):
    return await crud.project.create(db, project_in, owner_id=current_user.id)


@router.get("/{project_id}", response_model=schemas.ProjectOut)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await crud.project.get(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=schemas.ProjectOut)
async def update_project(
    project_id: int,
    project_in: schemas.ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ceo, UserRole.manager)),
):
    project = await crud.project.get(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role != UserRole.ceo and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your project")
    return await crud.project.update(db, project, project_in)


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ceo, UserRole.manager)),
):
    project = await crud.project.get(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if current_user.role != UserRole.ceo and project.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the team lead or CEO can delete this project")
    await crud.project.remove(db, project)


async def _get_project_or_404(db: AsyncSession, project_id: int):
    project = await crud.project.get(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _can_manage_members(user: User, project) -> bool:
    return user.role == UserRole.ceo or project.owner_id == user.id


@router.get("/{project_id}/members", response_model=list[schemas.UserOut])
async def list_members(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await _get_project_or_404(db, project_id)
    return await crud.project.get_members(db, project_id)


@router.post("/{project_id}/members", response_model=list[schemas.UserOut], status_code=201)
async def add_member(
    project_id: int,
    payload: schemas.ProjectMemberAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ceo, UserRole.manager)),
):
    project = await _get_project_or_404(db, project_id)
    if not _can_manage_members(current_user, project):
        raise HTTPException(status_code=403, detail="Only the project owner or CEO can add members")
    if not await crud.user.get(db, payload.user_id):
        raise HTTPException(status_code=404, detail="User not found")
    await crud.project.add_member(db, project_id, payload.user_id)
    return await crud.project.get_members(db, project_id)


@router.delete("/{project_id}/members/{user_id}", response_model=list[schemas.UserOut])
async def remove_member(
    project_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ceo, UserRole.manager)),
):
    project = await _get_project_or_404(db, project_id)
    if not _can_manage_members(current_user, project):
        raise HTTPException(status_code=403, detail="Only the project owner or CEO can remove members")
    await crud.project.remove_member(db, project_id, user_id)
    return await crud.project.get_members(db, project_id)
