from core.deps import get_current_user, get_supabase_admin
from fastapi import APIRouter, Depends, status
from schemas.payments import RegistrationOrderCreate, RegistrationPaymentOrderResponse
from services.payments import complete_registration_order, create_registration_order
from supabase import Client

router = APIRouter(prefix="/registration/gocardless", tags=["registration"])


@router.post("/orders", response_model=RegistrationPaymentOrderResponse, status_code=status.HTTP_201_CREATED)
def create_registration_order_endpoint(
    payload: RegistrationOrderCreate,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    return create_registration_order(supabase_admin, current_user, payload)


@router.post("/orders/{order_id}/complete", response_model=RegistrationPaymentOrderResponse)
def complete_registration_order_endpoint(
    order_id: str,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    return complete_registration_order(supabase_admin, current_user, order_id)
