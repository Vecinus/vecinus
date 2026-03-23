from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


# Enumerados que replican los tipos de Supabase
class MeetingType(str, Enum):
    ORDINARY = "ORDINARY"
    EXTRAORDINARY = "EXTRAORDINARY"


class MinuteStatus(str, Enum):
    DRAFT = "DRAFT"
    PENDING_SIGNATURES = "PENDING_SIGNATURES"
    SIGNED = "SIGNED"


class MeetingRole(str, Enum):
    PRESIDENT = "PRESIDENT"
    SECRETARY = "SECRETARY"
    ATTENDEE = "ATTENDEE"


class AgreementResult(str, Enum):
    APPROVED = "APPROVED"
    DENIED = "DENIED"


# Clases auxiliares para el contenido de actas
class Attendee(BaseModel):
    name: str
    role: MeetingRole
    is_present: bool
    represented_by: Optional[str] = None


class Agreement(BaseModel):
    description: str
    result: AgreementResult
    details: Optional[str] = None  # Ej: "Por unanimidad" o conteo de votos


class Task(BaseModel):
    responsible: str
    description: str
    deadline: str


# Modelo de Acta y Evidencia
class AIGeneratedContent(BaseModel):
    transcription: str
    summary: str
    topics: List[str]
    agreements: List[Agreement]
    tasks: List[Task]
    attendees: List[Attendee]


class MinutesResponse(AIGeneratedContent):
    # Cabecera (Metadata)
    title: str
    scheduled_at: datetime
    location: str
    meeting_type: MeetingType
    version: int = 1
    document_hash: Optional[str] = None


class MinutesReadResponse(MinutesResponse):
    id: str
    association_id: str
    status: MinuteStatus
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    locked_at: Optional[datetime] = None
