from core.deps import get_current_user, get_supabase, get_supabase_admin
from fastapi import APIRouter, Depends, status
from schemas.common_space import QRValidateRequest, QRValidationResponse, Reservation, ReservationCreate
from services.common_space.reservation_service import create_reservation, validate_qr_and_check_in
from supabase import Client

router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.post("/", response_model=Reservation, status_code=status.HTTP_201_CREATED)
def create_reservation_endpoint(
    payload: ReservationCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return create_reservation(supabase, current_user["id"], payload)


@router.post("/validate-qr", response_model=QRValidationResponse)
def validate_qr_endpoint(
    payload: QRValidateRequest,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    return validate_qr_and_check_in(supabase_admin, current_user["id"], payload)
