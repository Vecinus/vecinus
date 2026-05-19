from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field


class PollBase(BaseModel):
    title: str
    description: Optional[str] = None
    options: List[str]


class PollCreate(PollBase):
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    absentees_end_at: Optional[datetime] = None
    property_coefficients: Optional[Dict[str, float]] = None


class PollPublish(BaseModel):
    start_at: datetime
    end_at: datetime
    absentees_end_at: datetime
    status: str = "PUBLISHED"


class PollResponse(PollBase):
    id: UUID
    association_id: UUID
    created_by: UUID
    db_status: str = Field(alias="status")
    created_at: datetime
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    absentees_end_at: Optional[datetime] = None
    property_coefficients: Optional[Dict[str, float]] = None

    @staticmethod
    def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
        if value is None or value.tzinfo is not None:
            return value
        return value.replace(tzinfo=timezone.utc)

    @computed_field
    @property
    def current_status(self) -> str:
        if self.db_status in ("DRAFT", "CANCELLED"):
            return self.db_status
        if self.db_status == "MANUALLY_CLOSED":
            return "FINISHED"

        if self.db_status == "PUBLISHED":
            now = datetime.now(timezone.utc)
            start_at = self._as_utc(self.start_at)
            end_at = self._as_utc(self.end_at)
            absentees_end_at = self._as_utc(self.absentees_end_at)

            if not start_at or now < start_at:
                return "PENDING"

            if start_at and end_at and start_at <= now <= end_at:
                return "ACTIVE"

            if end_at and absentees_end_at and end_at < now <= absentees_end_at:
                return "WAITING_ABSENTEES"

            if absentees_end_at and now > absentees_end_at:
                return "FINISHED"

        return "UNKNOWN"

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
