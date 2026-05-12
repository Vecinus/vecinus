from datetime import datetime, time
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel

UsageMode = Literal["exclusive_reservation", "guest_pass"]


class CommonSpaceBase(BaseModel):
    name: str
    requires_qr: bool
    capacity: Optional[int] = None
    max_guests_per_reservation: Optional[int] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    usage_mode: UsageMode = "exclusive_reservation"


class CommonSpaceCreate(CommonSpaceBase):
    pass


class CommonSpaceUpdate(BaseModel):
    name: Optional[str] = None
    requires_qr: Optional[bool] = None
    capacity: Optional[int] = None
    max_guests_per_reservation: Optional[int] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    usage_mode: Optional[UsageMode] = None


class CommonSpace(CommonSpaceBase):
    id: int
    association_id: UUID
    created_at: Optional[datetime] = None
