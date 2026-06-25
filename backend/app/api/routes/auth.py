from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud, schemas
from app.api.deps import get_current_user, get_db
from app.core.security import create_access_token
from app.models.user import User

router = APIRouter()


@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
async def register(user_in: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await crud.user.get_by_email(db, user_in.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    return await crud.user.create(db, user_in)


@router.post("/login", response_model=schemas.Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)
):
    # OAuth2 form uses "username" — we treat it as the email.
    user = await crud.user.authenticate(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    return schemas.Token(access_token=create_access_token(user.id))


@router.post("/login/json", response_model=schemas.Token)
async def login_json(credentials: schemas.UserLogin, db: AsyncSession = Depends(get_db)):
    user = await crud.user.authenticate(db, credentials.email, credentials.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    return schemas.Token(access_token=create_access_token(user.id))


@router.get("/me", response_model=schemas.UserOut)
async def read_me(current_user: User = Depends(get_current_user)):
    return current_user
