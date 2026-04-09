from core.deps import get_current_user, get_supabase_admin
from fastapi import APIRouter, Depends, status
from schemas.payments import CommunityPaymentOrderCreate, CommunityPaymentOrderResponse
from services.payments import complete_extra_community_order, create_extra_community_order, get_extra_community_order
from supabase import Client

router = APIRouter(prefix="/payments/community-extras", tags=["community-payments"])


@router.post("/orders", response_model=CommunityPaymentOrderResponse, status_code=status.HTTP_201_CREATED)
def create_order_endpoint(
    payload: CommunityPaymentOrderCreate,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    return create_extra_community_order(supabase_admin, current_user, payload)


@router.get("/orders/{order_id}", response_model=CommunityPaymentOrderResponse)
def get_order_endpoint(
    order_id: str,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    return get_extra_community_order(supabase_admin, current_user["id"], order_id)


@router.post("/orders/{order_id}/complete", response_model=CommunityPaymentOrderResponse)
def complete_order_endpoint(
    order_id: str,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    return complete_extra_community_order(supabase_admin, current_user, order_id)
