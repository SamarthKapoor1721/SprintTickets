from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.user import UserOut


class MessageCreate(BaseModel):
    content: str


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    content: str
    sender_id: int
    recipient_id: int
    is_read: bool
    created_at: Optional[datetime] = None


class ConversationContact(BaseModel):
    """A person you can chat with, plus a preview of the latest message."""

    user: UserOut
    last_message: Optional[str] = None
    last_at: Optional[datetime] = None
    unread: int = 0
