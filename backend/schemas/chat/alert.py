from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


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
