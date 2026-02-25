from fastapi import APIRouter, HTTPException
from backend.services.chatBotService import get_chatbot_response
from backend.schemas.chatBot import ChatBotRequest, ChatBotResponse

router = APIRouter(prefix="/chatbot", tags=["chatbot"])

@router.post("/{comunidad_id}/chatbot", response_model=ChatBotResponse)
async def chatbotWithDocuments(comunidad_id, request):
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")
    
    data = get_chatbot_response(request.question, comunidad_id=comunidad_id)

    return data