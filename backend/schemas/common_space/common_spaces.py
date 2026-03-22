from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class CommonSpaceBase(BaseModel):
    name: str
    requires_qr: bool = False
    max_capacity: Optional[int] = None
    max_guests_per_reservation: Optional[int] = None
    photo_url: Optional[str] = None


class CommonSpaceCreate(CommonSpaceBase):
    association_id: Optional[UUID] = None


class CommonSpaceUpdate(BaseModel):
    name: Optional[str] = None
    requires_qr: Optional[bool] = None
    max_capacity: Optional[int] = None
    max_guests_per_reservation: Optional[int] = None
    photo_url: Optional[str] = None


class CommonSpace(CommonSpaceBase):
    id: int
    association_id: UUID
    created_at: Optional[datetime] = None
