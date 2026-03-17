from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class CommonSpaceBase(BaseModel):
    name: str
    requires_qr: bool = False


class CommonSpaceCreate(CommonSpaceBase):
    pass


class CommonSpaceUpdate(BaseModel):
    name: Optional[str] = None
    requires_qr: Optional[bool] = None


class CommonSpace(CommonSpaceBase):
    id: int
    association_id: UUID
    created_at: datetime