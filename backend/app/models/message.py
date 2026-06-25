from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base_class import Base


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)

    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    sender = relationship("User", foreign_keys=[sender_id], lazy="selectin")

    recipient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    recipient = relationship("User", foreign_keys=[recipient_id], lazy="selectin")

    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
