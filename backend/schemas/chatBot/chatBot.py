from pydantic import BaseModel
from typing import List, Optional

class ChatBotMessage(BaseModel):
    role: str
    content: str

class ChatBotRequest(BaseModel):
    comunidad_id: str
    question: str
    history: Optional[List[ChatBotMessage]] = None

class ChatAnswerSource(BaseModel):
    type: str
    reference: Optional[str] = None

class ChatBotResponse(BaseModel):
    answer: str
    source: ChatAnswerSource
    disclaimer: str