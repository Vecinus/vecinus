from api.chat.chat_helpers import verify_association_membership
from core.deps import get_current_user, get_supabase
from fastapi import APIRouter, Depends, HTTPException
from schemas.chatBot.chatBot import ChatBotRequest, ChatBotResponse
from services.chatBot.chatBotService import get_chatbot_response
from supabase import Client

router = APIRouter(prefix="/comunities", tags=["chatbot"])


@router.post("/{comunidad_id}/chatbot", response_model=ChatBotResponse)
async def chatbot_with_documents(
    comunidad_id: str,
    request: ChatBotRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    path_comunidad_id = str(comunidad_id).strip()

    if request.comunidad_id is not None and str(request.comunidad_id).strip() != path_comunidad_id:
        raise HTTPException(
            status_code=400,
            detail="El comunidad_id del path y del body no coinciden.",
        )

    pregunta = request.question

    if not pregunta.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacia.")

    verify_association_membership(path_comunidad_id, current_user["id"], supabase)

    # Backend stateless: no se guarda historial. El cliente puede mantenerlo si quiere.
    data = await get_chatbot_response(path_comunidad_id, pregunta, history=None)

    return data
