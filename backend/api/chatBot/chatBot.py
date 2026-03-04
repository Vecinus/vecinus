from fastapi import APIRouter, HTTPException
from schemas.chatBot.chatBot import ChatBotRequest, ChatBotResponse
from services.chatBot.chatBotService import get_chatbot_response

router = APIRouter(prefix="/comunities", tags=["chatbot"])


@router.post("/{comunidad_id}/chatbot", response_model=ChatBotResponse)
async def chatbot_with_documents(comunidad_id: str, request: ChatBotRequest):
    path_comunidad_id = str(comunidad_id).strip()

    if request.comunidad_id is not None and str(request.comunidad_id).strip() != path_comunidad_id:
        raise HTTPException(
            status_code=400,
            detail="El comunidad_id del path y del body no coinciden.",
        )

    # Sacamos la pregunta en formato texto del request
    pregunta = request.question

    if not pregunta.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacía.")

    # LLAMADA ASÍNCRONA (Añadido 'await')
    data = await get_chatbot_response(path_comunidad_id, pregunta)

    return data
