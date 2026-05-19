from datetime import datetime, time
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

UsageMode = Literal["exclusive_reservation", "guest_pass"]


class CommonSpaceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    requires_qr: bool
    capacity: Optional[int] = Field(default=None, ge=1)
    max_guests_per_reservation: Optional[int] = Field(default=None, ge=1)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    usage_mode: UsageMode = "exclusive_reservation"

    @model_validator(mode="after")
    def validate_time_window(self):
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValueError("start_time must be before end_time")
        return self


class CommonSpaceCreate(CommonSpaceBase):
    pass


class CommonSpaceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    requires_qr: Optional[bool] = None
    capacity: Optional[int] = Field(default=None, ge=1)
    max_guests_per_reservation: Optional[int] = Field(default=None, ge=1)
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    usage_mode: Optional[UsageMode] = None

    @model_validator(mode="after")
    def validate_time_window(self):
        if self.start_time and self.end_time and self.start_time >= self.end_time:
            raise ValueError("start_time must be before end_time")
        return self


class CommonSpace(CommonSpaceBase):
    id: int
    association_id: UUID
    created_at: Optional[datetime] = None
