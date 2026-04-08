from __future__ import annotations

from typing import Any

from core.config import settings
from fastapi import HTTPException, status
from schemas.payments import RegistrationOrderComplete, RegistrationOrderCreate
from services.payments.gocardless_service import (
    _create_billing_request_flow,
    _create_payment,
    _ensure_gocardless_configured,
    _gocardless_request,
)
from supabase import Client

ADMIN_ROLE = 1
ADMIN_ROLE_LABEL = "admin"


def _serialize_registration_order(order: dict[str, Any], token: str | None = None) -> dict[str, Any]:
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
        "token": token,
        "created_at": order["created_at"],
        "updated_at": order["updated_at"],
    }


def _load_registration_order(supabase_admin: Client, order_id: str) -> dict[str, Any]:
    order_res = supabase_admin.table("registration_payment_orders").select("*").eq("id", order_id).limit(1).execute()
    if not order_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Registration payment order not found")
    return order_res.data[0]


def _ensure_registration_email_available(supabase_admin: Client, email: str) -> None:
    auth_users = supabase_admin.auth.admin.list_users()
    registered_emails = {user.email for user in auth_users if getattr(user, "email", None)}
    if email in registered_emails:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="There is already a registered user with that email",
        )


def _create_registration_billing_request(order_id: str, amount_cents: int) -> dict[str, Any]:
    _ensure_gocardless_configured()
    payload = {
        "billing_requests": {
            "payment_request": {
                "amount": amount_cents,
                "currency": settings.MULTICOMMUNITY_CURRENCY,
                "description": "Initial community registration for Vecinus",
                "metadata": {"registration_order_id": order_id},
            },
            "mandate_request": {
                "currency": settings.MULTICOMMUNITY_CURRENCY,
                "scheme": settings.GOCARDLESS_SCHEME,
                "metadata": {"registration_order_id": order_id},
            },
        }
    }
    data = _gocardless_request("POST", "/billing_requests", payload, idempotency_key=f"reg-br-{order_id}")
    return data.get("billing_requests", {})


def _sign_in_after_registration(
    supabase_anon: Client,
    email: str,
    password: str,
) -> str | None:
    login_response = supabase_anon.auth.sign_in_with_password({"email": email, "password": password})
    if not getattr(login_response, "session", None):
        return None
    return login_response.session.access_token


def create_registration_order(supabase_admin: Client, payload: RegistrationOrderCreate) -> dict[str, Any]:
    _ensure_registration_email_available(supabase_admin, payload.email)

    order_insert_res = (
        supabase_admin.table("registration_payment_orders")
        .insert(
            {
                "email": payload.email,
                "username": payload.username,
                "community_name": payload.community_name,
                "community_address": payload.community_address,
                "amount_cents": settings.REGISTRATION_PAYMENT_AMOUNT_CENTS,
                "currency": settings.MULTICOMMUNITY_CURRENCY,
                "provider": "gocardless",
                "status": "pending",
                "granted_role": ADMIN_ROLE,
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
        billing_request = _create_registration_billing_request(order["id"], order["amount_cents"])
        flow = _create_billing_request_flow(order["id"], billing_request["id"])
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
    return _serialize_registration_order(updated_order)


def complete_registration_order(
    supabase_admin: Client,
    supabase_anon: Client,
    order_id: str,
    payload: RegistrationOrderComplete,
) -> dict[str, Any]:
    order = _load_registration_order(supabase_admin, order_id)

    if order["email"] != payload.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The email does not match the registration order",
        )

    if order.get("status") == "completed" and order.get("created_profile_id"):
        token = _sign_in_after_registration(supabase_anon, payload.email, payload.password)
        return _serialize_registration_order(order, token=token)

    billing_request_id = order.get("billing_request_id")
    if not billing_request_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The registration order has no GoCardless billing request yet",
        )

    billing_request_data = _gocardless_request("GET", f"/billing_requests/{billing_request_id}")
    billing_request = billing_request_data.get("billing_requests", {})
    billing_request_status = billing_request.get("status")
    mandate_id = (billing_request.get("links") or {}).get("mandate")

    if billing_request_status != "fulfilled" or not mandate_id:
        update_res = (
            supabase_admin.table("registration_payment_orders")
            .update({"status": "authorised" if billing_request_status == "fulfilled" else "pending"})
            .eq("id", order_id)
            .execute()
        )
        latest_order = (update_res.data or [order])[0]
        return _serialize_registration_order(latest_order)

    payment_id = order.get("payment_id")
    if not payment_id:
        payment = _create_payment(order_id, mandate_id, order["amount_cents"], 1)
        payment_id = payment.get("id")

    _ensure_registration_email_available(supabase_admin, payload.email)

    created_user = supabase_admin.auth.admin.create_user(
        {"email": payload.email, "password": payload.password, "email_confirm": True}
    )
    profile_id = str(created_user.user.id)

    supabase_admin.table("profiles").upsert({"id": profile_id, "username": order["username"]}).execute()

    association_res = (
        supabase_admin.table("neighborhood_associations")
        .insert({"name": order["community_name"], "address": order["community_address"]})
        .execute()
    )
    if not association_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The community could not be created after payment",
        )

    association_id = association_res.data[0]["id"]
    supabase_admin.table("memberships").insert(
        {
            "profile_id": profile_id,
            "association_id": association_id,
            "role": ADMIN_ROLE,
        }
    ).execute()

    update_res = (
        supabase_admin.table("registration_payment_orders")
        .update(
            {
                "status": "completed",
                "mandate_id": mandate_id,
                "payment_id": payment_id,
                "created_profile_id": profile_id,
                "created_association_id": association_id,
                "granted_role": ADMIN_ROLE,
            }
        )
        .eq("id", order_id)
        .execute()
    )
    updated_order = (update_res.data or [order])[0]

    token = _sign_in_after_registration(supabase_anon, payload.email, payload.password)
    return _serialize_registration_order(updated_order, token=token)
