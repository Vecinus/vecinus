from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class ReservationCreate(BaseModel):
    space_id: int
    start_at: datetime
    end_at: datetime
    guests_count: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_range(self):
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        return self


class QRValidateRequest(BaseModel):
    qr_token: UUID


class Reservation(BaseModel):
    id: int
    user_id: UUID
    space_id: int
    start_at: datetime
    end_at: datetime
    qr_token: UUID
    status_id: int
    guests_count: int


class QRValidationResponse(BaseModel):
    guests_count: int
    status: str = "checked_in"
