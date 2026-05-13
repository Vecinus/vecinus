from http import HTTPStatus

from core.deps import get_supabase_anon
from fastapi import APIRouter, Depends, HTTPException
from schemas.feedback.feedbackSchema import Feedback
from supabase import Client

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=HTTPStatus)
async def submit_feedback(feedback: Feedback, supabase: Client = Depends(get_supabase_anon)) -> HTTPStatus:

    insert_data = feedback.model_dump()
    try:
        supabase.table("feedback").insert(insert_data, returning="minimal").execute()
    except Exception:
        raise HTTPException(status_code=500, detail="Error al enviar el feedback")

    return HTTPStatus.OK
