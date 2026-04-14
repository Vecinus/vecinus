from core.deps import get_supabase_admin, get_supabase_anon
from fastapi import APIRouter, Depends, status
from schemas.payments import RegistrationOrderComplete, RegistrationOrderCreate, RegistrationPaymentOrderResponse
from services.payments import complete_registration_order, create_registration_order
from supabase import Client

router = APIRouter(prefix="/registration/gocardless", tags=["registration"])


@router.post("/orders", response_model=RegistrationPaymentOrderResponse, status_code=status.HTTP_201_CREATED)
def create_registration_order_endpoint(
    payload: RegistrationOrderCreate,
    supabase_admin: Client = Depends(get_supabase_admin),
):
    return create_registration_order(supabase_admin, payload)


@router.post("/orders/{order_id}/complete", response_model=RegistrationPaymentOrderResponse)
def complete_registration_order_endpoint(
    order_id: str,
    payload: RegistrationOrderComplete,
    supabase_admin: Client = Depends(get_supabase_admin),
    supabase_anon: Client = Depends(get_supabase_anon),
):
    return complete_registration_order(supabase_admin, supabase_anon, order_id, payload)
