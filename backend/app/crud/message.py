from sqlalchemy import and_, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.user import User


async def get_conversation(db: AsyncSession, user_a: int, user_b: int) -> list[Message]:
    stmt = (
        select(Message)
        .where(
            or_(
                and_(Message.sender_id == user_a, Message.recipient_id == user_b),
                and_(Message.sender_id == user_b, Message.recipient_id == user_a),
            )
        )
        .order_by(Message.created_at.asc(), Message.id.asc())
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_message(
    db: AsyncSession, sender_id: int, recipient_id: int, content: str
) -> Message:
    msg = Message(sender_id=sender_id, recipient_id=recipient_id, content=content)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def mark_read(db: AsyncSession, recipient_id: int, sender_id: int) -> None:
    """Mark messages from `sender_id` to `recipient_id` as read."""
    await db.execute(
        update(Message)
        .where(
            Message.recipient_id == recipient_id,
            Message.sender_id == sender_id,
            Message.is_read.is_(False),
        )
        .values(is_read=True)
    )
    await db.commit()


async def list_contacts(db: AsyncSession, current_user_id: int) -> list[dict]:
    """Everyone except the current user, with a preview of the latest exchange."""
    users = (
        await db.execute(select(User).where(User.id != current_user_id).order_by(User.full_name))
    ).scalars().all()

    contacts: list[dict] = []
    for u in users:
        convo = await get_conversation(db, current_user_id, u.id)
        last = convo[-1] if convo else None
        unread = sum(
            1 for m in convo if m.recipient_id == current_user_id and not m.is_read
        )
        contacts.append(
            {
                "user": u,
                "last_message": last.content if last else None,
                "last_at": last.created_at if last else None,
                "unread": unread,
            }
        )
    # Most recent conversations first; people with no history sink to the bottom.
    contacts.sort(key=lambda c: (c["last_at"] is not None, c["last_at"]), reverse=True)
    return contacts
