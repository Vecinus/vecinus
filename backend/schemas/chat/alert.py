from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class AlertBase(BaseModel):
    title: str = Field(..., max_length=200)
    content: str = Field(..., max_length=5000)


class AlertCreate(AlertBase):
    pass


class Alert(AlertBase):
    id: UUID
    user_id: UUID
    is_read: bool = False
    created_at: datetime

    class Config:
        from_attributes = True
