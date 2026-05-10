from __future__ import annotations

import logging
from typing import Any

from core.config import settings
from fastapi import HTTPException, status
from schemas.payments import RegistrationOrderCreate
from services.payments.gocardless_service import (
    create_billing_request_flow,
    create_mandate_billing_request,
    create_subscription,
    get_billing_request,
    get_mandate,
)
from supabase import Client

logger = logging.getLogger(__name__)

ADMIN_ROLE = 1
ADMIN_ROLE_LABEL = "admin"
DEFAULT_PLAN_CODE = "basic"


def _serialize_registration_order(
    order: dict[str, Any],
    plan_code: str | None = None,
) -> dict[str, Any]:
    return {
        "id": order["id"],
        "email": order["email"],
        "username": order["username"],
        "community_name": order["community_name"],
        "community_address": order["community_address"],
        "amount_cents": order["amount_cents"],
        "currency": order["currency"],
        "status": order["status"],
        "authorisation_url": order.get("authorisation_url"),
        "billing_request_id": order.get("billing_request_id"),
        "billing_request_flow_id": order.get("billing_request_flow_id"),
        "mandate_id": order.get("mandate_id"),
        "payment_id": order.get("payment_id"),
        "created_profile_id": order.get("created_profile_id"),
        "created_association_id": order.get("created_association_id"),
        "granted_role": order.get("granted_role", ADMIN_ROLE),
        "granted_role_label": ADMIN_ROLE_LABEL,
        "token": None,
        "plan_code": plan_code,
        "subscription_plan_id": order.get("subscription_plan_id"),
        "household_count": order.get("household_count", 0),
        "created_subscription_id": order.get("created_subscription_id"),
        "created_at": order["created_at"],
        "updated_at": order["updated_at"],
    }


def _load_registration_order(supabase_admin: Client, order_id: str) -> dict[str, Any]:
    order_res = supabase_admin.table("registration_payment_orders").select("*").eq("id", order_id).limit(1).execute()
    if not order_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration payment order not found")
    return order_res.data[0]


def _load_plan_by_code(supabase_admin: Client, code: str) -> dict[str, Any]:
    res = (
        supabase_admin.table("subscription_plans").select("*").eq("code", code).eq("is_active", True).limit(1).execute()
    )
    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Subscription plan '{code}' not configured in database",
        )
    return res.data[0]


def _load_plan_for_order(supabase_admin: Client, order: dict[str, Any]) -> dict[str, Any]:
    plan_id = order.get("subscription_plan_id")
    if plan_id:
        res = supabase_admin.table("subscription_plans").select("*").eq("id", plan_id).limit(1).execute()
        if res.data:
            return res.data[0]
    return _load_plan_by_code(supabase_admin, DEFAULT_PLAN_CODE)


def _calculate_amount_cents(plan: dict[str, Any], household_count: int) -> int:
    return int(plan["base_cents"]) + int(plan["per_household_cents"]) * int(household_count)


def _resolve_username(supabase_admin: Client, profile_id: str, fallback_email: str) -> str:
    """
    Lee el username del perfil del usuario autenticado. Si por alguna razón no
    existe (perfil sin completar), cae al prefijo del email.
    """
    res = supabase_admin.table("profiles").select("username").eq("id", profile_id).limit(1).execute()
    if res.data and res.data[0].get("username"):
        return str(res.data[0]["username"])
    return fallback_email.split("@", 1)[0] if "@" in fallback_email else fallback_email


def create_registration_order(
    supabase_admin: Client,
    current_user: dict[str, Any],
    payload: RegistrationOrderCreate,
) -> dict[str, Any]:
    """
    Crea una orden que representa la intención de un usuario AUTENTICADO de
    abrir una nueva comunidad con suscripción mensual SEPA. NO crea cuenta de
    usuario (ya existe) ni emite ningún cargo one-off; el primer cobro lo
    dispara la Subscription que se creará al confirmar.
    """
    profile_id = str(current_user["id"])
    user_email = str(current_user.get("email") or "")
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authenticated user has no email available in the JWT",
        )

    username = _resolve_username(supabase_admin, profile_id, user_email)
    plan = _load_plan_by_code(supabase_admin, payload.plan)
    first_amount_cents = _calculate_amount_cents(plan, payload.household_count)

    order_insert_res = (
        supabase_admin.table("registration_payment_orders")
        .insert(
            {
                "email": user_email,
                "username": username,
                "community_name": payload.community_name,
                "community_address": payload.community_address,
                "amount_cents": first_amount_cents,
                "currency": settings.MULTICOMMUNITY_CURRENCY,
                "provider": "gocardless",
                "status": "pending",
                "granted_role": ADMIN_ROLE,
                "subscription_plan_id": plan["id"],
                "household_count": payload.household_count,
                "created_profile_id": profile_id,
            }
        )
        .execute()
    )
    if not order_insert_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create the registration payment order",
        )

    order = order_insert_res.data[0]

    try:
        billing_request = create_mandate_billing_request(
            metadata={"registration_order_id": str(order["id"])},
            idempotency_key=f"reg-br-{order['id']}",
        )
        flow = create_billing_request_flow(
            billing_request_id=billing_request["id"],
            redirect_uri=(f"{settings.APP_BASE_URL.rstrip('/')}/payments/gocardless/complete?order_id={order['id']}"),
            idempotency_key=f"reg-brf-{order['id']}",
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


def _ensure_association(supabase_admin: Client, order: dict[str, Any]) -> str:
    existing_assoc_id = order.get("created_association_id")
    if existing_assoc_id:
        return str(existing_assoc_id)

    association_res = (
        supabase_admin.table("neighborhood_associations")
        .insert({"name": order["community_name"], "address": order["community_address"]})
        .execute()
    )
    if not association_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The community could not be created after payment authorisation",
        )
    return str(association_res.data[0]["id"])


def _ensure_admin_membership(supabase_admin: Client, profile_id: str, association_id: str) -> None:
    existing = (
        supabase_admin.table("memberships")
        .select("id")
        .eq("profile_id", profile_id)
        .eq("association_id", association_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return
    supabase_admin.table("memberships").insert(
        {"profile_id": profile_id, "association_id": association_id, "role": ADMIN_ROLE}
    ).execute()


def _ensure_community_subscription_row(
    supabase_admin: Client,
    association_id: str,
    plan_id: str,
    amount_cents: int,
    household_count: int,
    mandate_id: str,
    customer_id: str | None,
) -> dict[str, Any]:
    existing = (
        supabase_admin.table("community_subscriptions")
        .select("*")
        .eq("association_id", association_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return existing.data[0]

    insert_res = (
        supabase_admin.table("community_subscriptions")
        .insert(
            {
                "association_id": association_id,
                "subscription_plan_id": plan_id,
                "status": "pending_first_payment",
                "current_amount_cents": amount_cents,
                "household_count_snapshot": household_count,
                "gocardless_mandate_id": mandate_id,
                "gocardless_customer_id": customer_id,
                "mandate_status": "active",
            }
        )
        .execute()
    )
    if not insert_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The community subscription record could not be created",
        )
    return insert_res.data[0]


def _ensure_gocardless_subscription(
    supabase_admin: Client,
    cs_row: dict[str, Any],
    order: dict[str, Any],
    mandate_id: str,
    amount_cents: int,
) -> dict[str, Any]:
    if cs_row.get("gocardless_subscription_id"):
        return cs_row

    cs_id = str(cs_row["id"])
    association_id = str(cs_row["association_id"])

    try:
        gc_subscription = create_subscription(
            mandate_id=mandate_id,
            amount_cents=amount_cents,
            name=f"Vecinus - {order['community_name']}",
            metadata={
                "association_id": association_id,
                "subscription_id": cs_id,
                "registration_order_id": str(order["id"]),
            },
            idempotency_key=f"sub-{cs_id}",
        )
    except HTTPException:
        supabase_admin.table("registration_payment_orders").update({"status": "subscription_failed"}).eq(
            "id", order["id"]
        ).execute()
        logger.exception("GoCardless subscription creation failed for order %s (cs_id=%s)", order["id"], cs_id)
        raise

    update_res = (
        supabase_admin.table("community_subscriptions")
        .update({"gocardless_subscription_id": gc_subscription.get("id")})
        .eq("id", cs_id)
        .execute()
    )
    return (update_res.data or [cs_row])[0]


def _initialize_usage_counters(supabase_admin: Client, subscription_id: str) -> None:
    try:
        supabase_admin.rpc("reset_usage_counters", {"p_subscription_id": subscription_id}).execute()
    except Exception:
        # El cron diario `reset_stale_usage_counters` recuperará el estado.
        logger.exception("reset_usage_counters RPC failed for subscription %s", subscription_id)


def complete_registration_order(
    supabase_admin: Client,
    current_user: dict[str, Any],
    order_id: str,
) -> dict[str, Any]:
    """
    Verifica que el mandato está autorizado en GoCardless y, si lo está, crea:
        1. neighborhood_associations
        2. memberships(role=ADMIN) ligado al usuario autenticado
        3. community_subscriptions (status=pending_first_payment)
        4. Subscription en GoCardless (con metadata)
        5. community_usage_counters (RPC reset_usage_counters)
        6. registration_payment_orders.status=completed + created_subscription_id

    Cada paso es idempotente: una segunda llamada con la misma orden retoma
    el flujo desde donde se quedó. El usuario YA está autenticado: no se crea
    ninguna cuenta de Auth ni se emite JWT alguno.
    """
    order = _load_registration_order(supabase_admin, order_id)
    profile_id = str(current_user["id"])

    if order.get("created_profile_id") and str(order["created_profile_id"]) != profile_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This order belongs to another user",
        )

    if order.get("status") == "completed" and order.get("created_profile_id") and order.get("created_subscription_id"):
        plan = _load_plan_for_order(supabase_admin, order)
        return _serialize_registration_order(order, plan_code=plan["code"])

    billing_request_id = order.get("billing_request_id")
    if not billing_request_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The registration order has no GoCardless billing request yet",
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

    association_id = _ensure_association(supabase_admin, order)
    _ensure_admin_membership(supabase_admin, profile_id, association_id)

    supabase_admin.table("registration_payment_orders").update(
        {
            "mandate_id": mandate_id,
            "created_profile_id": profile_id,
            "created_association_id": association_id,
            "status": "authorised",
        }
    ).eq("id", order_id).execute()

    cs_row = _ensure_community_subscription_row(
        supabase_admin=supabase_admin,
        association_id=association_id,
        plan_id=str(plan["id"]),
        amount_cents=amount_cents,
        household_count=household_count,
        mandate_id=mandate_id,
        customer_id=customer_id,
    )

    cs_row = _ensure_gocardless_subscription(
        supabase_admin=supabase_admin,
        cs_row=cs_row,
        order=order,
        mandate_id=mandate_id,
        amount_cents=amount_cents,
    )

    _initialize_usage_counters(supabase_admin, str(cs_row["id"]))

    update_res = (
        supabase_admin.table("registration_payment_orders")
        .update(
            {
                "status": "completed",
                "mandate_id": mandate_id,
                "created_profile_id": profile_id,
                "created_association_id": association_id,
                "created_subscription_id": str(cs_row["id"]),
                "granted_role": ADMIN_ROLE,
            }
        )
        .eq("id", order_id)
        .execute()
    )
    updated_order = (update_res.data or [order])[0]

    return _serialize_registration_order(updated_order, plan_code=plan["code"])
