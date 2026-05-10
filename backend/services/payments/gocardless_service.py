from __future__ import annotations

import hashlib
import hmac
from typing import Any

import httpx
from core.config import settings
from fastapi import HTTPException, status
from schemas.payments import CommunityPaymentOrderCreate
from supabase import Client


def _ensure_gocardless_configured() -> None:
    if not settings.GOCARDLESS_ACCESS_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="GoCardless is not configured. Set GOCARDLESS_ACCESS_TOKEN in backend/.env",
        )


def _gocardless_headers(idempotency_key: str | None = None) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {settings.GOCARDLESS_ACCESS_TOKEN}",
        "GoCardless-Version": settings.GOCARDLESS_VERSION,
        "Content-Type": "application/json",
    }
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key
    return headers


def _gocardless_request(
    method: str,
    path: str,
    payload: dict[str, Any] | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    _ensure_gocardless_configured()
    url = f"{settings.GOCARDLESS_BASE_URL.rstrip('/')}{path}"

    try:
        response = httpx.request(
            method,
            url,
            headers=_gocardless_headers(idempotency_key),
            json=payload,
            timeout=30.0,
        )
        response.raise_for_status()
        if not response.content:
            return {}
        return response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text or exc.response.reason_phrase
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GoCardless request failed: {detail}",
        )
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not connect to GoCardless: {str(exc)}",
        )


def _ensure_user_is_admin_somewhere(supabase_admin: Client, user_id: str) -> None:
    membership_res = (
        supabase_admin.table("memberships")
        .select("association_id")
        .eq("profile_id", user_id)
        .eq("role", 1)
        .limit(1)
        .execute()
    )
    if not membership_res.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators with at least one existing community can buy extra communities",
        )


def _count_admin_communities(supabase_admin: Client, user_id: str) -> int:
    membership_res = (
        supabase_admin.table("memberships").select("association_id").eq("profile_id", user_id).eq("role", 1).execute()
    )
    return len(membership_res.data or [])


def _get_price_for_community_position(supabase_admin: Client, position: int) -> int:
    pricing_res = (
        supabase_admin.table("community_pricing_rules")
        .select("community_position_from, community_position_to, price_cents")
        .eq("is_active", True)
        .order("community_position_from")
        .execute()
    )
    rules = pricing_res.data or []
    if not rules:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No active community pricing rules configured",
        )

    for rule in rules:
        position_from = int(rule["community_position_from"])
        position_to = rule.get("community_position_to")
        if position < position_from:
            continue
        if position_to is None or position <= int(position_to):
            return int(rule["price_cents"])

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=f"No pricing rule found for community position {position}",
    )


def _serialize_order(order: dict[str, Any], items: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "id": order["id"],
        "quantity": order["quantity"],
        "unit_amount_cents": order["unit_amount_cents"],
        "total_amount_cents": order["total_amount_cents"],
        "currency": order["currency"],
        "status": order["status"],
        "authorisation_url": order.get("authorisation_url"),
        "billing_request_id": order.get("billing_request_id"),
        "billing_request_flow_id": order.get("billing_request_flow_id"),
        "mandate_id": order.get("mandate_id"),
        "payment_id": order.get("payment_id"),
        "created_at": order["created_at"],
        "updated_at": order["updated_at"],
        "items": items,
    }


def _load_order(
    supabase_admin: Client, order_id: str, current_user_id: str
) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    order_res = (
        supabase_admin.table("extra_community_payment_orders")
        .select("*")
        .eq("id", order_id)
        .eq("admin_profile_id", current_user_id)
        .limit(1)
        .execute()
    )
    if not order_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment order not found")

    items_res = (
        supabase_admin.table("extra_community_order_items").select("*").eq("payment_order_id", order_id).execute()
    )
    return order_res.data[0], items_res.data or []


def _create_billing_request(order_id: str, total_amount_cents: int, quantity: int) -> dict[str, Any]:
    payload = {
        "billing_requests": {
            "payment_request": {
                "amount": total_amount_cents,
                "currency": settings.MULTICOMMUNITY_CURRENCY,
                "description": f"{quantity} extra communities for Vecinus",
                "metadata": {"order_id": order_id},
            },
            "mandate_request": {
                "currency": settings.MULTICOMMUNITY_CURRENCY,
                "scheme": settings.GOCARDLESS_SCHEME,
                "metadata": {"order_id": order_id},
            },
        }
    }
    data = _gocardless_request("POST", "/billing_requests", payload, idempotency_key=f"br-{order_id}")
    return data.get("billing_requests", {})


def _create_billing_request_flow(order_id: str, billing_request_id: str) -> dict[str, Any]:
    redirect_uri = f"{settings.APP_BASE_URL.rstrip('/')}/payments/gocardless/complete?order_id={order_id}"
    payload = {
        "billing_request_flows": {
            "redirect_uri": redirect_uri,
            "exit_uri": settings.GOCARDLESS_EXIT_URI,
            "links": {"billing_request": billing_request_id},
        }
    }
    data = _gocardless_request(
        "POST",
        "/billing_request_flows",
        payload,
        idempotency_key=f"brf-{order_id}",
    )
    return data.get("billing_request_flows", {})


def _create_payment(order_id: str, mandate_id: str, total_amount_cents: int, quantity: int) -> dict[str, Any]:
    payload = {
        "payments": {
            "amount": total_amount_cents,
            "currency": settings.MULTICOMMUNITY_CURRENCY,
            "description": f"{quantity} extra communities for Vecinus",
            "links": {"mandate": mandate_id},
            "metadata": {"order_id": order_id},
        }
    }
    data = _gocardless_request("POST", "/payments", payload, idempotency_key=f"pay-{order_id}")
    return data.get("payments", {})


def _finalize_order_transactionally(
    supabase_admin: Client,
    order_id: str,
    current_user_id: str,
    mandate_id: str,
    payment_id: str,
) -> None:
    rpc_res = supabase_admin.rpc(
        "finalize_extra_community_order",
        {
            "p_order_id": order_id,
            "p_admin_profile_id": current_user_id,
            "p_mandate_id": mandate_id,
            "p_payment_id": payment_id,
        },
    ).execute()
    data = rpc_res.data
    if not data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="The paid communities could not be finalized",
        )

    result = data[0] if isinstance(data, list) else data
    if not result.get("ok", False):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=result.get("error") or "The paid communities could not be finalized",
        )


def create_extra_community_order(
    supabase_admin: Client,
    current_user: dict[str, Any],
    payload: CommunityPaymentOrderCreate,
) -> dict[str, Any]:
    if len(payload.communities) != payload.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quantity must match the number of communities provided",
        )

    current_user_id = current_user["id"]
    _ensure_user_is_admin_somewhere(supabase_admin, current_user_id)

    current_community_count = _count_admin_communities(supabase_admin, current_user_id)
    item_prices = [
        _get_price_for_community_position(supabase_admin, current_community_count + index + 1)
        for index in range(payload.quantity)
    ]
    total_amount = sum(item_prices)
    first_unit_amount = item_prices[0]

    order_insert_res = (
        supabase_admin.table("extra_community_payment_orders")
        .insert(
            {
                "admin_profile_id": current_user_id,
                "quantity": payload.quantity,
                "unit_amount_cents": first_unit_amount,
                "total_amount_cents": total_amount,
                "currency": settings.MULTICOMMUNITY_CURRENCY,
                "provider": "gocardless",
                "status": "pending",
            }
        )
        .execute()
    )
    if not order_insert_res.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create the payment order",
        )

    order = order_insert_res.data[0]

    supabase_admin.table("extra_community_order_items").insert(
        [
            {
                "payment_order_id": order["id"],
                "community_name": community.name,
                "community_address": community.address,
                "price_cents": item_prices[index],
                "status": "pending",
            }
            for index, community in enumerate(payload.communities)
        ]
    ).execute()

    try:
        billing_request = _create_billing_request(order["id"], total_amount, payload.quantity)
        flow = _create_billing_request_flow(order["id"], billing_request["id"])
    except HTTPException:
        supabase_admin.table("extra_community_payment_orders").update({"status": "failed"}).eq(
            "id", order["id"]
        ).execute()
        raise

    update_res = (
        supabase_admin.table("extra_community_payment_orders")
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
    items_res = (
        supabase_admin.table("extra_community_order_items").select("*").eq("payment_order_id", order["id"]).execute()
    )
    return _serialize_order(updated_order, items_res.data or [])


def get_extra_community_order(supabase_admin: Client, current_user_id: str, order_id: str) -> dict[str, Any]:
    order, items = _load_order(supabase_admin, order_id, current_user_id)
    return _serialize_order(order, items)


def complete_extra_community_order(
    supabase_admin: Client, current_user: dict[str, Any], order_id: str
) -> dict[str, Any]:
    current_user_id = current_user["id"]
    order, items = _load_order(supabase_admin, order_id, current_user_id)

    if order.get("status") == "paid":
        return _serialize_order(order, items)

    billing_request_id = order.get("billing_request_id")
    if not billing_request_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The order has no GoCardless billing request yet",
        )

    billing_request_data = _gocardless_request("GET", f"/billing_requests/{billing_request_id}")
    billing_request = billing_request_data.get("billing_requests", {})
    billing_request_status = billing_request.get("status")
    mandate_id = (billing_request.get("links") or {}).get("mandate")

    if billing_request_status != "fulfilled" or not mandate_id:
        update_res = (
            supabase_admin.table("extra_community_payment_orders")
            .update({"status": "authorised" if billing_request_status == "fulfilled" else "pending"})
            .eq("id", order_id)
            .execute()
        )
        latest_order = (update_res.data or [order])[0]
        latest_items = (
            supabase_admin.table("extra_community_order_items").select("*").eq("payment_order_id", order_id).execute()
        )
        return _serialize_order(latest_order, latest_items.data or [])

    payment_id = order.get("payment_id")
    if not payment_id:
        payment = _create_payment(order_id, mandate_id, order["total_amount_cents"], order["quantity"])
        payment_id = payment.get("id")

    _finalize_order_transactionally(supabase_admin, order_id, current_user_id, mandate_id, payment_id)

    updated_order, updated_items = _load_order(supabase_admin, order_id, current_user_id)
    return _serialize_order(updated_order, updated_items)


def verify_webhook_signature(body: bytes, signature: str | None) -> bool:
    """
    Valida la cabecera Webhook-Signature de GoCardless.

    GoCardless firma el body raw con HMAC-SHA256 usando el secret del endpoint
    configurado en el dashboard. Comparación en tiempo constante para evitar
    timing attacks.
    """
    secret = settings.GOCARDLESS_WEBHOOK_SECRET
    if not secret or not signature:
        return False

    expected = hmac.new(
        secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected.lower(), signature.strip().lower())


def create_mandate_billing_request(
    metadata: dict[str, str],
    first_payment_amount_cents: int | None = None,
    first_payment_description: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    """
    Crea un Billing Request para autorizar un mandato SEPA.

    Si se pasa `first_payment_amount_cents`, también se incluye el primer
    cobro (alta + 1ª cuota en un único flujo). En caso contrario, sólo se
    autoriza el mandato y la facturación posterior corre por cuenta de la
    Subscription.
    """
    request_body: dict[str, Any] = {
        "billing_requests": {
            "mandate_request": {
                "currency": settings.MULTICOMMUNITY_CURRENCY,
                "scheme": settings.GOCARDLESS_SCHEME,
                "metadata": metadata,
            },
        }
    }

    if first_payment_amount_cents is not None:
        request_body["billing_requests"]["payment_request"] = {
            "amount": first_payment_amount_cents,
            "currency": settings.MULTICOMMUNITY_CURRENCY,
            "description": first_payment_description or "Primer cobro Vecinus",
            "metadata": metadata,
        }

    data = _gocardless_request("POST", "/billing_requests", request_body, idempotency_key=idempotency_key)
    return data.get("billing_requests", {})


def create_billing_request_flow(
    billing_request_id: str,
    redirect_uri: str,
    exit_uri: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    """
    Crea el Hosted Authorisation Flow para que el cliente autorice el mandato.
    Devuelve el dict con `id` y `authorisation_url`.
    """
    payload: dict[str, Any] = {
        "billing_request_flows": {
            "redirect_uri": redirect_uri,
            "exit_uri": exit_uri or settings.GOCARDLESS_EXIT_URI,
            "links": {"billing_request": billing_request_id},
        }
    }
    data = _gocardless_request("POST", "/billing_request_flows", payload, idempotency_key=idempotency_key)
    return data.get("billing_request_flows", {})


def get_billing_request(billing_request_id: str) -> dict[str, Any]:
    data = _gocardless_request("GET", f"/billing_requests/{billing_request_id}")
    return data.get("billing_requests", {})


def get_mandate(mandate_id: str) -> dict[str, Any]:
    data = _gocardless_request("GET", f"/mandates/{mandate_id}")
    return data.get("mandates", {})


def get_payment(payment_id: str) -> dict[str, Any]:
    data = _gocardless_request("GET", f"/payments/{payment_id}")
    return data.get("payments", {})


def retry_payment(payment_id: str, idempotency_key: str | None = None) -> dict[str, Any]:
    """Fuerza el reintento manual de un payment fallido (acción del admin)."""
    data = _gocardless_request(
        "POST",
        f"/payments/{payment_id}/actions/retry",
        payload={"data": {}},
        idempotency_key=idempotency_key,
    )
    return data.get("payments", {})


def create_subscription(
    mandate_id: str,
    amount_cents: int,
    name: str,
    metadata: dict[str, str],
    day_of_month: int | None = None,
    start_date: str | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    """
    Crea una Subscription mensual atada al mandato.

    `start_date`: ISO date (YYYY-MM-DD) o None para usar la primera fecha
                  disponible que respete los plazos SEPA.
    `day_of_month`: 1-28 para fijar el día de cobro mensual; None deja que
                    GoCardless lo derive de la fecha del primer pago.
    """
    payload: dict[str, Any] = {
        "subscriptions": {
            "amount": amount_cents,
            "currency": settings.MULTICOMMUNITY_CURRENCY,
            "name": name,
            "interval": 1,
            "interval_unit": "monthly",
            "metadata": metadata,
            "links": {"mandate": mandate_id},
        }
    }
    if day_of_month is not None:
        payload["subscriptions"]["day_of_month"] = day_of_month
    if start_date is not None:
        payload["subscriptions"]["start_date"] = start_date

    data = _gocardless_request("POST", "/subscriptions", payload, idempotency_key=idempotency_key)
    return data.get("subscriptions", {})


def get_subscription(subscription_id: str) -> dict[str, Any]:
    data = _gocardless_request("GET", f"/subscriptions/{subscription_id}")
    return data.get("subscriptions", {})


def update_subscription(
    subscription_id: str,
    amount_cents: int | None = None,
    name: str | None = None,
    metadata: dict[str, str] | None = None,
) -> dict[str, Any]:
    """
    Actualiza una Subscription existente (p.ej. el importe cuando cambia el
    nº de viviendas). Sólo afecta a payments futuros, no a los ya creados.
    """
    body: dict[str, Any] = {}
    if amount_cents is not None:
        body["amount"] = amount_cents
    if name is not None:
        body["name"] = name
    if metadata is not None:
        body["metadata"] = metadata

    if not body:
        return get_subscription(subscription_id)

    data = _gocardless_request("PUT", f"/subscriptions/{subscription_id}", {"subscriptions": body})
    return data.get("subscriptions", {})


def cancel_subscription(
    subscription_id: str,
    metadata: dict[str, str] | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    """Cancela definitivamente la subscription. No revierte payments ya cobrados."""
    payload: dict[str, Any] = {"data": {}}
    if metadata is not None:
        payload["data"]["metadata"] = metadata

    data = _gocardless_request(
        "POST",
        f"/subscriptions/{subscription_id}/actions/cancel",
        payload=payload,
        idempotency_key=idempotency_key,
    )
    return data.get("subscriptions", {})


def create_one_off_payment(
    mandate_id: str,
    amount_cents: int,
    description: str,
    metadata: dict[str, str] | None = None,
    idempotency_key: str | None = None,
) -> dict[str, Any]:
    """
    Crea un payment SEPA one-off contra un mandato existente. Útil para cobros
    puntuales fuera del ciclo regular de la Subscription, como saldar una deuda
    pendiente tras una renovación de mandato.
    """
    payload: dict[str, Any] = {
        "payments": {
            "amount": amount_cents,
            "currency": settings.MULTICOMMUNITY_CURRENCY,
            "description": description,
            "links": {"mandate": mandate_id},
        }
    }
    if metadata:
        payload["payments"]["metadata"] = metadata

    data = _gocardless_request("POST", "/payments", payload, idempotency_key=idempotency_key)
    return data.get("payments", {})
