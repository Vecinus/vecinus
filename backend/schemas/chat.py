from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID

# Models for the dev.profiles table (simplified)
class ProfileResponse(BaseModel):
    id: UUID
    username: str
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None

# Models for the dev.chat_channels table
class ChatChannelBase(BaseModel):
    community_id: UUID
    name: Optional[str] = None
    is_direct_message: bool = False

class ChatChannelCreate(ChatChannelBase):
    pass

class ChatChannel(ChatChannelBase):
    id: UUID

    class Config:
        from_attributes = True

# Models for the dev.messages table
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

# Extended Message Model to include sender username (helpful for UI)
class MessageWithSender(Message):
    sender: Optional[ProfileResponse] = None
