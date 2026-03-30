from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class VoteCreate(BaseModel):
    selected_option: str
    voting_token: UUID
    rgpd_accepted: bool


class VoteResponse(BaseModel):
    id: UUID
    poll_id: UUID
    membership_id: UUID
    selected_option: str
    coefficient_snapshot: float
    is_presumed_vote: bool
    rgpd_accepted_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class VotingTokenResponse(BaseModel):
    token: UUID
    poll_id: UUID
    membership_id: UUID
    is_used: bool
    expires_at: datetime
