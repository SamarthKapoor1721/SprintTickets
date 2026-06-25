from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app import crud
from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.message import ConversationContact, MessageCreate, MessageOut

router = APIRouter()


@router.get("/contacts", response_model=list[ConversationContact])
async def list_contacts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await crud.message.list_contacts(db, current_user.id)


@router.get("/{user_id}", response_model=list[MessageOut])
async def get_conversation(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    other = await crud.user.get(db, user_id)
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    messages = await crud.message.get_conversation(db, current_user.id, user_id)
    # Opening the thread marks the other person's messages to me as read.
    await crud.message.mark_read(db, recipient_id=current_user.id, sender_id=user_id)
    return messages


@router.post("/{user_id}", response_model=MessageOut, status_code=201)
async def send_message(
    user_id: int,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot message yourself")
    other = await crud.user.get(db, user_id)
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    if not payload.content.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")
    return await crud.message.create_message(
        db, sender_id=current_user.id, recipient_id=user_id, content=payload.content
    )
