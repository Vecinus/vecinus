from typing import List, Optional

from pydantic import BaseModel


class ChatBotMessage(BaseModel):
    role: str
    content: str


class ChatBotRequest(BaseModel):
    comunidad_id: Optional[str] = None
    question: str
    history: Optional[List[ChatBotMessage]] = None


class ChatAnswerSource(BaseModel):
    type: str
    reference: Optional[str] = None


class ChatBotResponse(BaseModel):
    answer: str
    source: ChatAnswerSource
    disclaimer: str
