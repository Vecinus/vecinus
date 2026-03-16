from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, HttpUrl


class Incident(BaseModel):
    id: UUID
    type: str
    description: Optional[str] = None
    created_at: datetime
    image: Optional[HttpUrl] = None
    membership_id: Optional[UUID] = None


class IncidentState(BaseModel):
    id: UUID
    status: str
    created_at: datetime
    incident_id: Optional[UUID] = None
