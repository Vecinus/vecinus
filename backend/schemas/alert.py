from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID

class AlertBase(BaseModel):
    title: str
    content: str

class AlertCreate(AlertBase):
    pass

class Alert(AlertBase):
    id: UUID
    user_id: UUID
    is_read: bool = False
    created_at: datetime

    class Config:
        from_attributes = True
