from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class GuestPassCreate(BaseModel):
    space_id: int
    valid_for_date: date


class GuestPass(BaseModel):
    id: int
    user_id: UUID
    space_id: int
    valid_for_date: date
    qr_token: UUID
    status_id: int
    checked_in_at: datetime | None = None
    created_at: datetime | None = None
