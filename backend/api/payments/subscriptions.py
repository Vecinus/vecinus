"""
Endpoints de gestión de la suscripción de una comunidad.

    GET  /payments/subscriptions/{community_id}        — estado + plan + último cobro
    GET  /payments/subscriptions/{community_id}/usage  — cupos del periodo en curso
    POST /payments/subscriptions/{community_id}/retry  — reintenta el último payment fallido
    POST /payments/subscriptions/{community_id}/renew  — abre flujo de mandato nuevo

Permisos:
    * GET status:  miembros con rol admin (1) o presidente (4) de la comunidad.
    * GET usage:   cualquier miembro de la comunidad.
    * POST retry:  sólo admin (1) — es una acción de cobro.
    * POST renew:  sólo admin (1) — abre flujo de cambio de cuenta bancaria.

Todas las consultas usan el cliente service_role para bypassear RLS, pero la
autorización (rol de membership) se valida explícitamente en cada endpoint.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from core.config import settings
from core.deps import get_current_user, get_supabase_admin
from fastapi import APIRouter, Depends, HTTPException, status
from schemas.payments import (
    CancelSubscriptionResponse,
    RegistrationPaymentOrderResponse,
    SubscriptionActivationOrderCreate,
    SubscriptionChangeRequest,
)
from services.payments import (
    complete_subscription_activation_order,
    complete_subscription_reactivation_order,
    create_subscription_activation_order,
    create_subscription_reactivation_order,
)
from services.payments.gocardless_service import (
    cancel_subscription,
    create_billing_request_flow,
    create_mandate_billing_request,
    retry_payment,
    update_subscription,
)
from services.payments.subscription_service import (
    calculate_amount_cents,
    count_association_properties,
    load_association_household_count,
    load_plan_by_code,
    load_plan_by_id,
    load_subscription,
    resolve_operational_household_limit,
)
from services.payments.usage_counters_service import ensure_usage_counters_initialized
from supabase import Client

router = APIRouter(prefix="/payments/subscriptions", tags=["subscriptions"])


@router.post(
    "/{community_id}/activation-orders",
    response_model=RegistrationPaymentOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_activation_order(
    community_id: UUID,
    payload: SubscriptionActivationOrderCreate,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    association_id = str(community_id)
    return create_subscription_activation_order(supabase_admin, current_user, association_id, payload)


@router.post(
    "/{community_id}/reactivation-orders",
    response_model=RegistrationPaymentOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_reactivation_order(
    community_id: UUID,
    payload: SubscriptionActivationOrderCreate,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    association_id = str(community_id)
    return create_subscription_reactivation_order(supabase_admin, current_user, association_id, payload)


@router.post("/activation-orders/{order_id}/complete", response_model=RegistrationPaymentOrderResponse)
def complete_activation_order(
    order_id: str,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    return complete_subscription_activation_order(supabase_admin, current_user, order_id)


@router.post("/reactivation-orders/{order_id}/complete", response_model=RegistrationPaymentOrderResponse)
def complete_reactivation_order(
    order_id: str,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    return complete_subscription_reactivation_order(supabase_admin, current_user, order_id)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# -----------------------------------------------------------------------------
# Helpers de autorización
# -----------------------------------------------------------------------------


def _get_user_role_in_community(supabase_admin: Client, profile_id: str, association_id: str) -> int | None:
    res = (
        supabase_admin.table("memberships")
        .select("role")
        .eq("profile_id", profile_id)
        .eq("association_id", association_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    try:
        return int(res.data[0].get("role"))
    except (TypeError, ValueError):
        return None


def _require_membership(
    supabase_admin: Client,
    profile_id: str,
    association_id: str,
    allowed_roles: set[int] | None = None,
) -> int:
    role = _get_user_role_in_community(supabase_admin, profile_id, association_id)
    if role is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No perteneces a esta comunidad",
        )
    if allowed_roles is not None and role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Esta acción requiere uno de los roles {sorted(allowed_roles)}",
        )
    return role


def _load_subscription(supabase_admin: Client, association_id: str) -> dict[str, Any]:
    return load_subscription(supabase_admin, association_id)


def _load_association_household_count(supabase_admin: Client, association_id: str) -> int:
    return load_association_household_count(supabase_admin, association_id)


def _count_association_properties(supabase_admin: Client, association_id: str) -> int:
    return count_association_properties(supabase_admin, association_id)


def _build_usage_fallback(
    association_id: str,
    subscription_id: str,
    subscription_status: str,
    plan: dict[str, Any] | None,
    household_count: int,
) -> dict[str, Any]:
    safe_household_count = max(int(household_count or 0), 0)
    chatbot_base = int((plan or {}).get("chatbot_base_msg") or 0)
    chatbot_per_household = int((plan or {}).get("chatbot_per_household_msg") or 0)
    chatbot_quota = chatbot_base + chatbot_per_household * safe_household_count
    minutes_per_month = int((plan or {}).get("minutes_seconds_per_month") or 0)
    minutes_cap = int((plan or {}).get("minutes_seconds_cap") or 0)

    return {
        "association_id": association_id,
        "subscription_id": subscription_id,
        "subscription_status": subscription_status,
        "chatbot": {"used": 0, "quota": chatbot_quota, "remaining": chatbot_quota},
        "minutes": {
            "used_seconds": 0,
            "balance_seconds": minutes_per_month,
            "remaining_seconds": minutes_per_month,
            "cap_seconds": minutes_cap,
        },
        "period_started_at": None,
        "period_ends_at": None,
        "last_reset_at": None,
    }


# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------


@router.get("/{community_id}")
def get_subscription_status(
    community_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    """
    Devuelve el estado completo de la suscripción + plan + última factura
    para que el panel de admin lo muestre. Sólo admins/presidentes.
    """
    association_id = str(community_id)
    _require_membership(supabase_admin, current_user["id"], association_id, allowed_roles={1, 4})

    subscription = _load_subscription(supabase_admin, association_id)
    plan = load_plan_by_id(supabase_admin, subscription["subscription_plan_id"])
    pending_plan = None
    if subscription.get("pending_subscription_plan_id"):
        pending_plan = load_plan_by_id(supabase_admin, subscription["pending_subscription_plan_id"])
    household_count = _load_association_household_count(supabase_admin, association_id)
    current_household_count = _count_association_properties(supabase_admin, association_id)
    operational_household_limit = resolve_operational_household_limit(subscription, household_count)

    invoices_res = (
        supabase_admin.table("subscription_invoices")
        .select(
            "id, gocardless_payment_id, amount_cents, currency, status, "
            "failure_reason, charge_date, period_start, period_end, "
            "created_at, updated_at"
        )
        .eq("community_subscription_id", subscription["id"])
        .order("created_at", desc=True)
        .limit(12)
        .execute()
    )

    is_blocked = subscription["status"] not in ("active", "pending_first_payment")

    return {
        "id": subscription["id"],
        "association_id": association_id,
        "status": subscription["status"],
        "is_blocked": is_blocked,
        "plan": plan,
        "pending_plan": pending_plan,
        "current_amount_cents": subscription.get("current_amount_cents"),
        "household_count": household_count,
        "current_household_count": current_household_count,
        "operational_household_limit": operational_household_limit,
        "pending_household_count": subscription.get("pending_household_count"),
        "pending_amount_cents": subscription.get("pending_amount_cents"),
        "pending_change_requested_at": subscription.get("pending_change_requested_at"),
        "mandate_status": subscription.get("mandate_status"),
        "gocardless_subscription_id": subscription.get("gocardless_subscription_id"),
        "current_period_start": subscription.get("current_period_start"),
        "current_period_end": subscription.get("current_period_end"),
        "last_payment_at": subscription.get("last_payment_at"),
        "last_failure_at": subscription.get("last_failure_at"),
        "failure_count": subscription.get("failure_count", 0),
        "cancelled_at": subscription.get("cancelled_at"),
        "invoices": invoices_res.data or [],
    }


@router.get("/{community_id}/usage")
def get_subscription_usage(
    community_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    """
    Cupos del periodo en curso. Cualquier miembro puede consultarlo (sirve
    para la UI mostrar "te quedan X mensajes / Y minutos").
    """
    association_id = str(community_id)
    _require_membership(supabase_admin, current_user["id"], association_id)

    subscription = _load_subscription(supabase_admin, association_id)
    plan = load_plan_by_id(supabase_admin, subscription["subscription_plan_id"])
    household_count = _load_association_household_count(supabase_admin, association_id)

    counters_res = (
        supabase_admin.table("community_usage_counters")
        .select("*")
        .eq("community_subscription_id", subscription["id"])
        .limit(1)
        .execute()
    )

    if not counters_res.data:
        ensure_usage_counters_initialized(supabase_admin, str(subscription["id"]))
        counters_res = (
            supabase_admin.table("community_usage_counters")
            .select("*")
            .eq("community_subscription_id", subscription["id"])
            .limit(1)
            .execute()
        )

    if not counters_res.data:
        # Si falta la fila técnica de contadores, devolvemos la cuota base del
        # plan para no mostrar 0/0 en una suscripción activa mientras se
        # recupera la inicialización persistida.
        return _build_usage_fallback(
            association_id=association_id,
            subscription_id=subscription["id"],
            subscription_status=subscription["status"],
            plan=plan,
            household_count=household_count,
        )

    counters = counters_res.data[0]
    chatbot_quota = int(counters.get("chatbot_messages_quota") or 0)
    chatbot_used = int(counters.get("chatbot_messages_used") or 0)
    minutes_balance = int(counters.get("minutes_seconds_balance") or 0)
    minutes_used = int(counters.get("minutes_seconds_used") or 0)

    return {
        "association_id": association_id,
        "subscription_id": subscription["id"],
        "subscription_status": subscription["status"],
        "chatbot": {
            "used": chatbot_used,
            "quota": chatbot_quota,
            "remaining": max(chatbot_quota - chatbot_used, 0),
        },
        "minutes": {
            "used_seconds": minutes_used,
            "balance_seconds": minutes_balance,
            "remaining_seconds": max(minutes_balance - minutes_used, 0),
            "cap_seconds": int(counters.get("minutes_seconds_cap") or 0),
        },
        "period_started_at": counters.get("period_started_at"),
        "period_ends_at": counters.get("period_ends_at"),
        "last_reset_at": counters.get("last_reset_at"),
    }


@router.patch("/{community_id}")
def schedule_subscription_change(
    community_id: UUID,
    payload: SubscriptionChangeRequest,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    association_id = str(community_id)
    _require_membership(supabase_admin, current_user["id"], association_id, allowed_roles={1})

    subscription = _load_subscription(supabase_admin, association_id)
    current_property_count = _count_association_properties(supabase_admin, association_id)
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

    active_household_count = _load_association_household_count(supabase_admin, association_id)
    next_plan = load_plan_by_code(supabase_admin, payload.plan)
    pending_amount_cents = calculate_amount_cents(next_plan, payload.household_count)

    gc_subscription_id = subscription.get("gocardless_subscription_id")
    if gc_subscription_id:
        update_subscription(
            subscription_id=str(gc_subscription_id),
            amount_cents=pending_amount_cents,
            metadata={
                "subscription_id": str(subscription["id"]),
                "pending_plan_code": str(next_plan["code"]),
                "pending_household_count": str(payload.household_count),
            },
        )

    update_payload = {
        "pending_subscription_plan_id": next_plan["id"],
        "pending_household_count": payload.household_count,
        "pending_amount_cents": pending_amount_cents,
        "pending_change_requested_at": _now_iso(),
    }
    updated_subscription_res = (
        supabase_admin.table("community_subscriptions").update(update_payload).eq("id", subscription["id"]).execute()
    )
    updated_subscription = (updated_subscription_res.data or [dict(subscription, **update_payload)])[0]

    return {
        "ok": True,
        "message": "El cambio se ha programado para el siguiente ciclo de facturación.",
        "pending_plan": next_plan,
        "pending_household_count": updated_subscription.get("pending_household_count"),
        "pending_amount_cents": updated_subscription.get("pending_amount_cents"),
        "operational_household_limit": resolve_operational_household_limit(
            updated_subscription,
            active_household_count,
        ),
    }


@router.post("/{community_id}/retry", status_code=status.HTTP_202_ACCEPTED)
def retry_failed_payment(
    community_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    """
    Fuerza el reintento del último payment fallido de la suscripción.
    Útil cuando el admin acaba de actualizar la cuenta bancaria. Sólo admin (1).

    Importante: este endpoint NO usa `require_active_community`. Si lo hiciera
    el bloqueo impediría salir del estado past_due, que es exactamente lo que
    queremos resolver.
    """
    association_id = str(community_id)
    _require_membership(supabase_admin, current_user["id"], association_id, allowed_roles={1})

    subscription = _load_subscription(supabase_admin, association_id)

    invoice_res = (
        supabase_admin.table("subscription_invoices")
        .select("id, gocardless_payment_id, status, failure_reason, created_at")
        .eq("community_subscription_id", subscription["id"])
        .in_("status", ["failed", "cancelled", "charged_back"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not invoice_res.data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay ningún cobro fallido reciente que reintentar",
        )

    invoice = invoice_res.data[0]
    payment_id = invoice["gocardless_payment_id"]

    try:
        gc_payment = retry_payment(
            payment_id=payment_id,
            idempotency_key=f"retry-{invoice['id']}",
        )
    except HTTPException as exc:
        # `retry_payment` envuelve errores de GoCardless como 502 con un detalle
        # que contiene el JSON crudo. Para no exponer ese ruido en la UI lo
        # parseamos y, si reconocemos `invalid_state` o `retry_failed`, lo
        # convertimos en un 400 con copy amigable que dirige al usuario al
        # botón "Cambiar cuenta bancaria".
        detail_text = str(exc.detail) if exc.detail else ""
        reasons = _extract_gocardless_error_reasons(detail_text)

        if "invalid_state" in reasons or "Only failed payments" in detail_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Este cobro fue cancelado y no puede reintentarse. "
                    "Por favor, utiliza la opción de cambiar cuenta bancaria."
                ),
            ) from exc

        if "retry_failed" in reasons:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "GoCardless rechazó el reintento. Es probable que la cuenta "
                    "bancaria asociada ya no sea válida; usa la opción de "
                    "cambiar cuenta bancaria para iniciar un mandato nuevo."
                ),
            ) from exc

        # Cualquier otro error de GoCardless: re-raise tal cual (502 + detalle).
        raise

    return {
        "ok": True,
        "message": "Reintento solicitado a GoCardless. La confirmación llegará por webhook.",
        "payment_id": payment_id,
        "invoice_id": invoice["id"],
        "gocardless_payment_status": gc_payment.get("status"),
    }


def _extract_gocardless_error_reasons(detail_text: str) -> list[str]:
    """
    Saca los `errors[*].reason` del JSON que GoCardless devuelve dentro del
    `detail` envuelto por `_gocardless_request`. Si no es JSON válido devuelve
    una lista vacía.
    """
    if not detail_text:
        return []
    # `_gocardless_request` usa el prefijo "GoCardless request failed: " antes
    # del JSON crudo. Lo recortamos si está, si no probamos a parsear directo.
    json_part = detail_text
    marker = "GoCardless request failed:"
    if marker in detail_text:
        json_part = detail_text.split(marker, 1)[1].strip()

    try:
        parsed = json.loads(json_part)
    except (json.JSONDecodeError, TypeError):
        return []

    err = parsed.get("error") if isinstance(parsed, dict) else None
    if not isinstance(err, dict):
        return []
    items = err.get("errors", [])
    if not isinstance(items, list):
        return []
    return [str(item.get("reason")) for item in items if isinstance(item, dict) and item.get("reason")]


@router.post("/{community_id}/cancel", response_model=CancelSubscriptionResponse)
def cancel_subscription_now(
    community_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    association_id = str(community_id)
    _require_membership(supabase_admin, current_user["id"], association_id, allowed_roles={1})

    subscription = _load_subscription(supabase_admin, association_id)
    if subscription.get("status") == "cancelled":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This subscription is already cancelled")

    gc_subscription_id = subscription.get("gocardless_subscription_id")
    if gc_subscription_id:
        cancel_subscription(
            str(gc_subscription_id),
            metadata={
                "reason": "manual_cancellation",
                "subscription_id": str(subscription["id"]),
                "association_id": association_id,
            },
            idempotency_key=f"manual-cancel-{subscription['id']}",
        )

    (
        supabase_admin.table("community_subscriptions")
        .update(
            {
                "status": "cancelled",
                "cancelled_at": _now_iso(),
            }
        )
        .eq("id", subscription["id"])
        .execute()
    )

    return {
        "ok": True,
        "message": "La suscripción se ha cancelado inmediatamente.",
    }


@router.post("/{community_id}/renew", status_code=status.HTTP_201_CREATED)
def renew_subscription_mandate(
    community_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    """
    Genera un Billing Request + Flow para que el admin (rol 1) cambie la
    cuenta bancaria asociada a la suscripción de su comunidad.

    Caso de uso típico: el mandato actual fue cancelado por el banco o el
    último cobro entró en estado terminal y ya no admite retry. El admin
    pulsa "Cambiar cuenta bancaria" en el panel de recuperación; el frontend
    abre el `checkout_url` devuelto en el navegador para que el cliente
    autorice el nuevo mandato SEPA.

    Se reutilizan `create_mandate_billing_request` y `create_billing_request_flow`
    del cliente GoCardless. La metadata del billing_request incluye el id de
    `community_subscriptions` para que el worker del webhook pueda enlazar el
    nuevo mandato a la suscripción existente cuando llegue `mandates.active`.

    NOTA: este endpoint NO usa `require_active_community`. Si lo hiciera, el
    bloqueo por `mandate_invalid` impediría llegar a la única acción que sirve
    para resolverlo.

    NOTA (deuda técnica): el cierre completo del flujo de renovación
    (rotar `gocardless_mandate_id` y crear una Subscription nueva en
    GoCardless al recibir el webhook) queda fuera del alcance de esta
    iteración; con esto se devuelve la URL para que el flujo manual del
    admin no quede bloqueado.
    """
    association_id = str(community_id)
    _require_membership(supabase_admin, current_user["id"], association_id, allowed_roles={1})

    subscription = _load_subscription(supabase_admin, association_id)
    subscription_id = str(subscription["id"])

    # uuid4 garantiza que cada click crea un Billing Request nuevo en GoCardless;
    # si el admin ya autorizó uno y vuelve a pulsar el botón, no recibe el flow
    # consumido sino uno fresco.
    request_token = uuid4().hex[:12]

    billing_request = create_mandate_billing_request(
        metadata={
            "renewal_subscription_id": subscription_id,
            "association_id": association_id,
        },
        idempotency_key=f"renew-br-{subscription_id}-{request_token}",
    )
    flow = create_billing_request_flow(
        billing_request_id=billing_request["id"],
        redirect_uri=(
            f"{settings.APP_BASE_URL.rstrip('/')}/payments/gocardless/renew-complete"
            f"?subscription_id={subscription_id}"
        ),
        idempotency_key=f"renew-flow-{subscription_id}-{request_token}",
    )

    checkout_url = flow.get("authorisation_url")
    if not checkout_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="GoCardless no devolvió una URL de autorización para el nuevo mandato.",
        )

    return {"checkout_url": checkout_url}
