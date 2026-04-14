from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class Incident(BaseModel):
    id: Optional[UUID] = None
    type: str
    description: Optional[str] = None
    created_at: Optional[datetime] = None
    image_url: Optional[str] = None
    membership_id: Optional[UUID] = None
    status: Optional[str] = None
    incident_states: Optional[list["IncidentState"]] = None


class IncidentState(BaseModel):
    id: Optional[int] = None
    status: str
    created_at: Optional[datetime] = None
    incident_id: Optional[UUID] = None
