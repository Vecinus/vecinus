from pydantic import BaseModel, Field


class Feedback(BaseModel):
    feedback: str = Field(..., max_length=2000)
