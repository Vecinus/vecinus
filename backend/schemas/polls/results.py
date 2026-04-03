from typing import List
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class OptionResult(BaseModel):
    option_text: str
    total_votes_count: int
    total_coefficient: float


# Esquema para el desglose nominal (quién votó qué)
class VoterDetail(BaseModel):
    property_number: str
    voted_for: str
    coefficient: float
    is_presumed: bool


class PollResultResponse(BaseModel):
    poll_id: UUID

    census_eligible_voters: int
    census_eligible_coefficient: float

    total_votes_cast: int
    presumed_votes_applied: int

    results: List[OptionResult]

    voters_list: List[VoterDetail] = []

    model_config = ConfigDict(from_attributes=True)
