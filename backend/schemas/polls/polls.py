from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator


class PollBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    options: List[str] = Field(..., min_length=2, max_length=10)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Poll title cannot be empty")
        return stripped

    @field_validator("options")
    @classmethod
    def validate_options(cls, options: List[str]) -> List[str]:
        cleaned = [option.strip() for option in options]
        if any(not option for option in cleaned):
            raise ValueError("Poll options cannot be empty")
        if len(set(cleaned)) != len(cleaned):
            raise ValueError("Poll options must be unique")
        return cleaned


class PollCreate(PollBase):
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    absentees_end_at: Optional[datetime] = None
    property_coefficients: Optional[Dict[str, float]] = None

    @model_validator(mode="after")
    def validate_optional_dates(self):
        if self.start_at and self.end_at and self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        if self.end_at and self.absentees_end_at and self.absentees_end_at <= self.end_at:
            raise ValueError("absentees_end_at must be after end_at")
        return self


class PollPublish(BaseModel):
    start_at: datetime
    end_at: datetime
    absentees_end_at: datetime
    status: str = "PUBLISHED"

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_at <= self.start_at:
            raise ValueError("end_at must be after start_at")
        if self.absentees_end_at <= self.end_at:
            raise ValueError("absentees_end_at must be after end_at")
        return self


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
