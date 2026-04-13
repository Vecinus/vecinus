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


class GuestPassSummary(BaseModel):
    id: int
    user_id: UUID
    space_id: int
    space_name: str
    association_id: UUID
    requires_qr: bool
    valid_for_date: date
    qr_token: UUID
    status_id: int
    checked_in_at: datetime | None = None
    created_at: datetime | None = None


class GuestPassCancelResponse(BaseModel):
    id: int
    deleted: bool
