from fastapi import APIRouter, HTTPException
from schemas.chatBot.chatBot import ChatBotRequest, ChatBotResponse
from services.chatBot.chatBotService import get_chatbot_response

router = APIRouter(prefix="/comunities", tags=["chatbot"])


@router.post("/{comunidad_id}/chatbot", response_model=ChatBotResponse)
async def chatbot_with_documents(comunidad_id: str, request: ChatBotRequest):
    # Sacamos la pregunta en formato texto del request
    pregunta = request.question

    if not pregunta.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")

    # LLAMADA ASÍNCRONA (Añadido 'await')
    data = await get_chatbot_response(comunidad_id, pregunta)

    return data
