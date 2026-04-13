from datetime import date

from core.deps import get_current_user, get_supabase, get_supabase_admin
from fastapi import APIRouter, Depends, Query, status
from schemas.common_space import (
    OccupiedSlot,
    QRValidateRequest,
    QRValidationResponse,
    Reservation,
    ReservationCancelResponse,
    ReservationCreate,
    ReservationSummary,
)
from services.common_space.reservation_service import (
    cancel_reservation,
    create_reservation,
    list_occupied_slots,
    list_user_reservations,
    validate_qr_and_check_in,
)
from supabase import Client

router = APIRouter(prefix="/reservations", tags=["reservations"])


@router.post("/", response_model=Reservation, status_code=status.HTTP_201_CREATED)
def create_reservation_endpoint(
    payload: ReservationCreate,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    return create_reservation(supabase_admin, current_user["id"], payload)


@router.get("/occupied-slots", response_model=list[OccupiedSlot])
def list_occupied_slots_endpoint(
    space_id: int = Query(...),
    reservation_date: date = Query(...),
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    return list_occupied_slots(supabase_admin, current_user["id"], space_id, reservation_date)


@router.get("/me", response_model=list[ReservationSummary])
def list_my_reservations_endpoint(
    association_id: str = Query(...),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    return list_user_reservations(supabase, current_user["id"], association_id)


@router.patch("/{reservation_id}/cancel", response_model=ReservationCancelResponse)
def cancel_reservation_endpoint(
    reservation_id: int,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    return cancel_reservation(supabase_admin, current_user["id"], reservation_id)


@router.post("/validate-qr", response_model=QRValidationResponse)
def validate_qr_endpoint(
    payload: QRValidateRequest,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    return validate_qr_and_check_in(supabase_admin, current_user["id"], payload)
