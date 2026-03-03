from pydantic import BaseModel


class Task(BaseModel):
    responsible: str
    description: str
    deadline: str


class MinutesResponse(BaseModel):
    transcription: str
    summary: str
    topics: list[str]
    agreements: list[str]
    tasks: list[Task]