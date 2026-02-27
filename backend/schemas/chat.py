from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# Models para la tabla dev.profiles (simplified)
class ProfileResponse(BaseModel):
    id: UUID
    username: str
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None

# Models para la tabla dev.chat_channels
class ChatChannelBase(BaseModel):
    association_id: UUID
    name: Optional[str] = None
    is_direct_message: bool = False
    is_blocked: bool = False
    blocked_by: Optional[UUID] = None

class DirectMessageCreate(BaseModel):
    target_user_id: UUID

class ChatChannelCreate(ChatChannelBase):
    pass

class ChatChannel(ChatChannelBase):
    id: UUID

    class Config:
        from_attributes = True

# Models para la tabla dev.messages
class MessageBase(BaseModel):
    content: str
    channel_id: UUID
    updated_at: Optional[datetime] = None
    is_edited: bool = False

class MessageCreate(MessageBase):
    pass

class MessageUpdate(BaseModel):
    content: str

class Message(MessageBase):
    id: UUID
    sender_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

# Extended Message Model para incluir el nombre del remitente (útil para la UI)
class MessageWithSender(Message):
    sender: Optional[ProfileResponse] = None
