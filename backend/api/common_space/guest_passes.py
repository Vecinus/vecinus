from core.deps import get_current_user, get_supabase, get_supabase_admin
from fastapi import APIRouter, Depends, Query, status
from schemas.common_space import GuestPass, GuestPassCancelResponse, GuestPassCreate, GuestPassSummary
from services.common_space.guest_pass_service import cancel_guest_pass, create_guest_pass, list_user_guest_passes
from supabase import Client

router = APIRouter(prefix="/guest-passes", tags=["guest_passes"])


@router.post("/", response_model=GuestPass, status_code=status.HTTP_201_CREATED)
def create_guest_pass_endpoint(
    payload: GuestPassCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return create_guest_pass(supabase, current_user["id"], payload)


@router.get("/me", response_model=list[GuestPassSummary])
def list_my_guest_passes_endpoint(
    association_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return list_user_guest_passes(supabase, current_user["id"], association_id)


@router.patch("/{guest_pass_id}/cancel", response_model=GuestPassCancelResponse)
def cancel_guest_pass_endpoint(
    guest_pass_id: int,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    return cancel_guest_pass(supabase_admin, current_user["id"], guest_pass_id)
