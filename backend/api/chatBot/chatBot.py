from api.chat.chat_helpers import verify_association_membership
from core.config import settings
from core.deps import get_current_user, get_supabase, get_supabase_admin, require_active_community
from fastapi import APIRouter, Depends, HTTPException, status
from schemas.chatBot.chatBot import ChatBotRequest, ChatBotResponse
from services.chatBot.chatBotService import get_chatbot_response, truncate_chatbot_answer
from services.payments.usage_service import consume_chatbot_message, revert_chatbot_message
from supabase import Client

router = APIRouter(prefix="/comunities", tags=["chatbot"])


@router.post(
    "/{comunidad_id}/chatbot",
    response_model=ChatBotResponse,
    dependencies=[Depends(require_active_community)],
)
async def chatbot_with_documents(
    comunidad_id: str,
    request: ChatBotRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    path_comunidad_id = str(comunidad_id).strip()

    if request.comunidad_id is not None and str(request.comunidad_id).strip() != path_comunidad_id:
        raise HTTPException(
            status_code=400,
            detail="El comunidad_id del path y del body no coinciden.",
        )

    pregunta = request.question
    if not pregunta or not pregunta.strip():
        raise HTTPException(status_code=400, detail="La pregunta no puede estar vacia.")

    # Validación dura del límite de caracteres del plan (300 por defecto).
    if len(pregunta) > settings.CHATBOT_INPUT_CHAR_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=(
                f"La pregunta excede el límite de {settings.CHATBOT_INPUT_CHAR_LIMIT} caracteres. "
                f"Longitud actual: {len(pregunta)}."
            ),
        )

    verify_association_membership(path_comunidad_id, current_user["id"], supabase)

    # Consumimos cuota ANTES de tocar Gemini para evitar carreras de varias
    # peticiones simultáneas excediendo el quota.
    consumption = consume_chatbot_message(supabase_admin, path_comunidad_id)
    if not consumption["allowed"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "quota_exhausted",
                "resource": "chatbot",
                "message": "Se agotó el cupo de mensajes del chatbot para este periodo.",
                "resets_at": consumption.get("resets_at"),
            },
        )

    try:
        data = await get_chatbot_response(path_comunidad_id, pregunta, history=None)
    except Exception:
        # Compensación: si la llamada al LLM falla revertimos el consumo
        # para que el usuario no pierda el mensaje.
        revert_chatbot_message(supabase_admin, path_comunidad_id)
        raise

    # Trunca la respuesta al límite de salida del plan (1000 chars por defecto)
    answer = data.get("answer") or ""
    data["answer"] = truncate_chatbot_answer(answer, settings.CHATBOT_OUTPUT_CHAR_LIMIT)

    return data
