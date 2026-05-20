from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AnnouncementBase(BaseModel):
    title: str = Field(..., max_length=200)
    content: str = Field(..., max_length=10000)
    image_url: Optional[str] = Field(None, max_length=2048)
    status: str = Field(default="DRAFT", max_length=20, description="Status can be DRAFT or PUBLISHED")
    scheduled_date: Optional[datetime] = Field(None, description="Scheduled publication date for the announcement")


class AnnouncementCreate(AnnouncementBase):
    pass


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=200)
    content: Optional[str] = Field(None, max_length=10000)
    image_url: Optional[str] = Field(None, max_length=2048)
    status: Optional[str] = Field(None, max_length=20, description="Status can be DRAFT or PUBLISHED")
    scheduled_date: Optional[datetime] = Field(None, description="Scheduled publication date for the announcement")


class AnnouncementResponse(AnnouncementBase):
    id: str
    association_id: str
    created_by: str
    created_at: datetime
    updated_at: datetime
    scheduled_date: Optional[datetime] = None

    class Config:
        from_attributes = True
