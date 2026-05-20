from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class Incident(BaseModel):
    id: Optional[UUID] = None
    type: str = Field(..., max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    created_at: Optional[datetime] = None
    image_url: Optional[str] = Field(None, max_length=2048)
    membership_id: Optional[UUID] = None
    status: Optional[str] = Field(None, max_length=50)
    incident_states: Optional[list["IncidentState"]] = None


class IncidentState(BaseModel):
    id: Optional[int] = None
    status: str = Field(..., max_length=50)
    created_at: Optional[datetime] = None
    incident_id: Optional[UUID] = None
