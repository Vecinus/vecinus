from fastapi import APIRouter, HTTPException
from backend.schemas.chatBot.chatBot import ChatBotResponse, ChatBotRequest
from backend.services.chatBot.chatBotService import get_chatbot_response

from backend.schemas.chatBot.chatBot import ChatBotResponse
from backend.services.chatBot.chatBotService import get_chatbot_response


router = APIRouter(prefix="/comunities", tags=["chatbot"])

@router.post("/{comunidad_id}/chatbot", response_model=ChatBotResponse)
async def chatbot_with_documents(comunidad_id: int, request: ChatBotRequest):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")
    data = get_chatbot_response(comunidad_id, request.question)

    return data