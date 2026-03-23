from core.deps import get_current_user, get_supabase
from fastapi import APIRouter, Depends, status
from schemas.common_space import GuestPass, GuestPassCreate
from services.common_space.guest_pass_service import create_guest_pass
from supabase import Client

router = APIRouter(prefix="/guest-passes", tags=["guest_passes"])


@router.post("/", response_model=GuestPass, status_code=status.HTTP_201_CREATED)
def create_guest_pass_endpoint(
    payload: GuestPassCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return create_guest_pass(supabase, current_user["id"], payload)
