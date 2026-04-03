from datetime import datetime, timezone
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, computed_field


class PollBase(BaseModel):
    title: str
    description: Optional[str] = None
    options: List[str]


class PollCreate(PollBase):
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    absentees_end_at: Optional[datetime] = None


class PollPublish(BaseModel):
    start_at: datetime
    end_at: datetime
    absentees_end_at: datetime
    status: str = "PUBLISHED"


class PollResponse(PollBase):
    id: UUID
    association_id: UUID
    created_by: UUID
    db_status: str
    created_at: datetime
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    absentees_end_at: Optional[datetime] = None

    @computed_field
    @property
    def current_status(self) -> str:
        if self.db_status in ("DRAFT", "CANCELLED"):
            return self.db_status
        if self.db_status == "MANUALLY_CLOSED":
            return "FINISHED"

        if self.db_status == "PUBLISHED":
            now = datetime.now(timezone.utc)

            if not self.start_at or now < self.start_at:
                return "PENDING"

            if self.start_at and self.end_at and self.start_at <= now <= self.end_at:
                return "ACTIVE"

            if self.end_at and self.absentees_end_at and self.end_at < now <= self.absentees_end_at:
                return "WAITING_ABSENTEES"

            if self.absentees_end_at and now > self.absentees_end_at:
                return "FINISHED"

        return "UNKNOWN"

    model_config = ConfigDict(from_attributes=True)
