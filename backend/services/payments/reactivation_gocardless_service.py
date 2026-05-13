from __future__ import annotations

from typing import Any

from core.config import settings
from fastapi import HTTPException, status
from schemas.payments import RegistrationPaymentOrderResponse, SubscriptionActivationOrderCreate
from services.payments.activation_gocardless_service import _load_existing_association, _require_admin_membership
from services.payments.gocardless_service import (
    create_billing_request_flow,
    create_mandate_billing_request,
    create_subscription,
    get_billing_request,
    get_mandate,
)
from services.payments.registration_gocardless_service import (
    _calculate_amount_cents,
    _load_plan_by_code,
    _load_plan_for_order,
    _load_registration_order,
    _resolve_username,
    _serialize_registration_order,
)
from services.payments.subscription_service import count_association_properties, load_subscription
from services.payments.usage_counters_service import ensure_usage_counters_initialized
from supabase import Client


def _require_cancelled_subscription(supabase_admin: Client, association_id: str) -> dict[str, Any]:
    subscription = load_subscription(supabase_admin, association_id)
    if subscription.get("status") != "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This community does not have a cancelled subscription to reactivate",
        )
    return subscription


def create_subscription_reactivation_order(
    supabase_admin: Client,
    current_user: dict[str, Any],
    association_id: str,
    payload: SubscriptionActivationOrderCreate,
) -> RegistrationPaymentOrderResponse:
    profile_id = str(current_user["id"])
    user_email = str(current_user.get("email") or "")
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authenticated user has no email available in the JWT",
        )

    association = _load_existing_association(supabase_admin, association_id)
    _require_admin_membership(supabase_admin, profile_id, association_id)
    _require_cancelled_subscription(supabase_admin, association_id)

    current_property_count = count_association_properties(supabase_admin, association_id)
    if payload.household_count < current_property_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "household_limit_below_current_usage",
                "message": "No puedes reducir el limite por debajo del numero de viviendas creadas.",
                "current_count": current_property_count,
                "requested_limit": payload.household_count,
            },
        )

    username = _resolve_username(supabase_admin, profile_id, user_email)
    plan = _load_plan_by_code(supabase_admin, payload.plan)
    amount_cents = _calculate_amount_cents(plan, payload.household_count)

    order_insert_res = (
        supabase_admin.table("registration_payment_orders")
        .insert(
            {
                "email": user_email,
                "username": username,
                "community_name": association.get("name") or "",
                "community_address": association.get("address") or "",
                "amount_cents": amount_cents,
                "currency": settings.MULTICOMMUNITY_CURRENCY,
                "provider": "gocardless",
                "status": "pending",
                "granted_role": 1,
                "subscription_plan_id": plan["id"],
                "household_count": payload.household_count,
                "created_profile_id": profile_id,
                "created_association_id": association_id,
            }
        )
        .execute()
    )
    if not order_insert_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create the reactivation payment order",
        )

    order = order_insert_res.data[0]
    try:
        billing_request = create_mandate_billing_request(
            metadata={"registration_order_id": str(order["id"]), "association_id": association_id},
            idempotency_key=f"reactivation-br-{order['id']}",
        )
        flow = create_billing_request_flow(
            billing_request_id=billing_request["id"],
            redirect_uri=(
                f"{settings.APP_BASE_URL.rstrip('/')}/payments/gocardless/complete?reactivation_order_id={order['id']}"
            ),
            idempotency_key=f"reactivation-brf-{order['id']}",
        )
    except HTTPException:
        supabase_admin.table("registration_payment_orders").update({"status": "failed"}).eq("id", order["id"]).execute()
        raise

    update_res = (
        supabase_admin.table("registration_payment_orders")
        .update(
            {
                "billing_request_id": billing_request.get("id"),
                "billing_request_flow_id": flow.get("id"),
                "authorisation_url": flow.get("authorisation_url"),
                "status": "redirect_created",
            }
        )
        .eq("id", order["id"])
        .execute()
    )
    updated_order = (update_res.data or [order])[0]
    return _serialize_registration_order(updated_order, plan_code=plan["code"])


def complete_subscription_reactivation_order(
    supabase_admin: Client,
    current_user: dict[str, Any],
    order_id: str,
) -> RegistrationPaymentOrderResponse:
    order = _load_registration_order(supabase_admin, order_id)
    profile_id = str(current_user["id"])
    if order.get("created_profile_id") and str(order["created_profile_id"]) != profile_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This order belongs to another user")

    if order.get("status") == "completed" and order.get("created_subscription_id"):
        plan = _load_plan_for_order(supabase_admin, order)
        return _serialize_registration_order(order, plan_code=plan["code"])

    association_id = str(order.get("created_association_id") or "")
    if not association_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reactivation order is not linked to an existing community",
        )

    _load_existing_association(supabase_admin, association_id)
    _require_admin_membership(supabase_admin, profile_id, association_id)
    existing_subscription = _require_cancelled_subscription(supabase_admin, association_id)

    billing_request_id = order.get("billing_request_id")
    if not billing_request_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The reactivation order has no GoCardless billing request yet",
        )

    billing_request = get_billing_request(billing_request_id)
    billing_request_status = billing_request.get("status")
    mandate_id = (billing_request.get("links") or {}).get("mandate_request_mandate")
    if billing_request_status != "fulfilled" or not mandate_id:
        update_res = (
            supabase_admin.table("registration_payment_orders")
            .update({"status": "authorised" if billing_request_status == "fulfilled" else "pending"})
            .eq("id", order_id)
            .execute()
        )
        latest_order = (update_res.data or [order])[0]
        plan = _load_plan_for_order(supabase_admin, latest_order)
        return _serialize_registration_order(latest_order, plan_code=plan["code"])

    plan = _load_plan_for_order(supabase_admin, order)
    household_count = int(order.get("household_count") or 0)
    amount_cents = _calculate_amount_cents(plan, household_count)
    mandate_data = get_mandate(mandate_id)
    customer_id = (mandate_data.get("links") or {}).get("customer")

    association_update_res = (
        supabase_admin.table("neighborhood_associations")
        .update({"household_count": household_count})
        .eq("id", association_id)
        .execute()
    )
    updated_association = (association_update_res.data or [{}])[0]

    gc_subscription = create_subscription(
        mandate_id=mandate_id,
        amount_cents=amount_cents,
        name=f"Vecinus - {updated_association.get('name') or order.get('community_name') or 'Comunidad'}",
        metadata={
            "association_id": association_id,
            "subscription_id": str(existing_subscription["id"]),
            "reactivation_order_id": str(order["id"]),
        },
        idempotency_key=f"reactivation-sub-{existing_subscription['id']}-{mandate_id}",
    )

    supabase_admin.table("registration_payment_orders").update(
        {"mandate_id": mandate_id, "status": "authorised", "created_association_id": association_id}
    ).eq("id", order_id).execute()

    updated_subscription_res = (
        supabase_admin.table("community_subscriptions")
        .update(
            {
                "subscription_plan_id": plan["id"],
                "status": "pending_first_payment",
                "current_amount_cents": amount_cents,
                "gocardless_mandate_id": mandate_id,
                "gocardless_customer_id": customer_id,
                "gocardless_subscription_id": gc_subscription.get("id"),
                "mandate_status": "active",
                "cancelled_at": None,
                "last_failure_at": None,
                "failure_count": 0,
                "last_payment_at": None,
                "current_period_start": None,
                "current_period_end": None,
                "pending_subscription_plan_id": None,
                "pending_household_count": None,
                "pending_amount_cents": None,
                "pending_change_requested_at": None,
            }
        )
        .eq("id", existing_subscription["id"])
        .execute()
    )
    updated_subscription = (updated_subscription_res.data or [existing_subscription])[0]
    ensure_usage_counters_initialized(supabase_admin, str(updated_subscription["id"]))

    update_res = (
        supabase_admin.table("registration_payment_orders")
        .update(
            {
                "status": "completed",
                "mandate_id": mandate_id,
                "created_association_id": association_id,
                "created_subscription_id": str(updated_subscription["id"]),
                "community_name": updated_association.get("name") or order.get("community_name"),
                "community_address": updated_association.get("address") or order.get("community_address"),
                "granted_role": 1,
            }
        )
        .eq("id", order_id)
        .execute()
    )
    updated_order = (update_res.data or [order])[0]
    return _serialize_registration_order(updated_order, plan_code=plan["code"])
