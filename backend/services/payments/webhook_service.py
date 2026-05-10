"""
Worker de procesado de eventos de GoCardless.

Las requests del webhook persisten cada evento en `dev_s2.gocardless_webhook_events`
con `processed_at = NULL` y devuelven 204 inmediatamente. Después invocan a
`process_pending_events` vía `BackgroundTasks` de FastAPI, que es lo que aquí
implementamos: leer eventos pendientes, despacharlos al handler correspondiente
y marcarlos `processed_at = now()`.

Toda escritura usa el cliente service_role (`supabase_admin`) para bypassear el
RLS de las tablas de pagos.

Idempotencia:
    * Cada evento tiene UNIQUE (provider_event_id), de modo que GoCardless puede
      reenviar sin duplicar filas.
    * Los handlers son idempotentes a nivel de side-effects: poner un status
      a 'active' dos veces es la misma operación; insertar una factura usa
      ON CONFLICT por payment_id; el reset de cuotas reescribe la misma fila.

Race condition aceptada:
    Si dos hits del webhook llegan a la vez y disparan dos workers simultáneos,
    pueden tomar el mismo evento sin procesar. El UPDATE final por id es atómico,
    pero los side-effects (p.ej. enviar email) pueden duplicarse. Se asume
    aceptable para el TFG; si en producción no lo fuera, hay que añadir un
    SELECT ... FOR UPDATE SKIP LOCKED dentro de una RPC SQL.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from core.deps import get_supabase_admin
from services.email_service import send_payment_failed_email
from services.payments.gocardless_service import (
    cancel_subscription,
    create_subscription,
    get_billing_request,
    get_mandate,
    get_payment,
)
from supabase import Client

logger = logging.getLogger(__name__)

_BLOCKING_PAYMENT_ACTIONS = {"failed", "cancelled", "customer_approval_denied"}
_CHARGEBACK_ACTIONS = {"late_failure_settled", "chargeback_settled"}
_BLOCKING_MANDATE_ACTIONS = {"failed", "cancelled", "expired"}
_NON_RESETTABLE_CONFIRMED_STATUSES = {
    "confirmed",
    "paid_out",
    "failed",
    "cancelled",
    "customer_approval_denied",
    "charged_back",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _first(rows: list[dict[str, Any]] | None) -> dict[str, Any] | None:
    return rows[0] if rows else None


def _load_subscription_by_mandate(supabase_admin: Client, mandate_id: str) -> dict[str, Any] | None:
    res = (
        supabase_admin.table("community_subscriptions")
        .select("*")
        .eq("gocardless_mandate_id", mandate_id)
        .limit(1)
        .execute()
    )
    return _first(res.data)


def _load_subscription_by_gocardless_id(supabase_admin: Client, gc_subscription_id: str) -> dict[str, Any] | None:
    res = (
        supabase_admin.table("community_subscriptions")
        .select("*")
        .eq("gocardless_subscription_id", gc_subscription_id)
        .limit(1)
        .execute()
    )
    return _first(res.data)


def _load_invoice_by_payment_id(supabase_admin: Client, payment_id: str) -> dict[str, Any] | None:
    res = (
        supabase_admin.table("subscription_invoices")
        .select("*")
        .eq("gocardless_payment_id", payment_id)
        .limit(1)
        .execute()
    )
    return _first(res.data)


def _load_association(supabase_admin: Client, association_id: str) -> dict[str, Any] | None:
    res = (
        supabase_admin.table("neighborhood_associations")
        .select("id, name, household_count")
        .eq("id", association_id)
        .limit(1)
        .execute()
    )
    return _first(res.data)


def _upsert_invoice_from_payment(
    supabase_admin: Client,
    payment_id: str,
    subscription_row: dict[str, Any],
    new_status: str,
    failure_reason: str | None = None,
    payment_dict: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """
    Inserta o actualiza una fila en subscription_invoices.

    Si no existe, intenta hidratar amount/currency desde el payload `payment_dict`
    o haciendo GET /payments/{id} a GoCardless.
    """
    existing = _load_invoice_by_payment_id(supabase_admin, payment_id)
    if existing:
        update_payload: dict[str, Any] = {"status": new_status, "updated_at": _now_iso()}
        if failure_reason and not existing.get("failure_reason"):
            update_payload["failure_reason"] = failure_reason[:500]
        res = supabase_admin.table("subscription_invoices").update(update_payload).eq("id", existing["id"]).execute()
        return _first(res.data) or existing

    if payment_dict is None:
        try:
            payment_dict = get_payment(payment_id)
        except Exception:
            logger.exception(
                "Could not GET /payments/%s while upserting invoice; skipping insert",
                payment_id,
            )
            return None

    insert_payload = {
        "community_subscription_id": str(subscription_row["id"]),
        "gocardless_payment_id": payment_id,
        "amount_cents": int(payment_dict.get("amount") or subscription_row.get("current_amount_cents") or 0),
        "currency": payment_dict.get("currency") or "EUR",
        "status": new_status,
        "charge_date": payment_dict.get("charge_date"),
        "failure_reason": (failure_reason or "")[:500] or None,
    }
    res = supabase_admin.table("subscription_invoices").insert(insert_payload).execute()
    return _first(res.data)


def _set_subscription_status(
    supabase_admin: Client,
    subscription_id: str,
    status_: str,
    extra: dict[str, Any] | None = None,
) -> None:
    payload: dict[str, Any] = {"status": status_, "updated_at": _now_iso()}
    if extra:
        payload.update(extra)
    supabase_admin.table("community_subscriptions").update(payload).eq("id", subscription_id).execute()


def _reset_usage_counters(supabase_admin: Client, subscription_id: str) -> None:
    try:
        supabase_admin.rpc("reset_usage_counters", {"p_subscription_id": subscription_id}).execute()
    except Exception:
        logger.exception("reset_usage_counters RPC failed for subscription %s", subscription_id)


def _usage_counters_exist(supabase_admin: Client, subscription_id: str) -> bool:
    res = (
        supabase_admin.table("community_usage_counters")
        .select("community_subscription_id")
        .eq("community_subscription_id", subscription_id)
        .limit(1)
        .execute()
    )
    return bool(res.data)


def _ensure_usage_counters_initialized(supabase_admin: Client, subscription_id: str) -> None:
    _reset_usage_counters(supabase_admin, subscription_id)
    if _usage_counters_exist(supabase_admin, subscription_id):
        return

    logger.warning(
        "Usage counters missing after reset for subscription %s; retrying once",
        subscription_id,
    )
    _reset_usage_counters(supabase_admin, subscription_id)
    if not _usage_counters_exist(supabase_admin, subscription_id):
        logger.error(
            "Usage counters still missing after retry for subscription %s",
            subscription_id,
        )


def _should_reset_usage_on_payment_confirmed(previous_invoice_status: str | None, has_usage_counters: bool) -> bool:
    """
    Sólo abrir/recalcular cuota cuando este `confirmed` representa el cobro del
    nuevo ciclo. Si el pago estaba fallido y se recupera después, desbloqueamos
    la comunidad pero no concedemos cuota adicional retroactiva.
    """
    if previous_invoice_status is None:
        return True
    if not has_usage_counters:
        return True
    return previous_invoice_status not in _NON_RESETTABLE_CONFIRMED_STATUSES


def _handle_billing_request_fulfilled(supabase_admin: Client, event: dict[str, Any]) -> None:
    links = event.get("links") or {}
    billing_request_id = links.get("billing_request")
    if not billing_request_id:
        logger.warning("billing_requests.fulfilled without links.billing_request: %s", event.get("id"))
        return

    supabase_admin.table("registration_payment_orders").update({"status": "authorised", "updated_at": _now_iso()}).eq(
        "billing_request_id", billing_request_id
    ).execute()

    try:
        billing_request = get_billing_request(billing_request_id)
    except Exception:
        logger.exception(
            "billing_requests.fulfilled: no se pudo cargar BR %s para chequeo de renovación",
            billing_request_id,
        )
        return

    renewal_subscription_id = _extract_renewal_subscription_id(billing_request)
    if not renewal_subscription_id:
        return

    new_mandate_id = _extract_mandate_id_from_billing_request(billing_request)
    if not new_mandate_id:
        logger.warning(
            "billing_requests.fulfilled (renovación) %s sin mandate_id en links",
            billing_request_id,
        )
        return

    _process_subscription_renewal(supabase_admin, renewal_subscription_id, new_mandate_id)


def _extract_renewal_subscription_id(billing_request: dict[str, Any]) -> str | None:
    """Lee `renewal_subscription_id` de la metadata del billing_request.

    GoCardless puede colocar la metadata a nivel de billing_request o anidada
    en mandate_request, según el shape de creación. Comprobamos ambas.
    """
    candidates = [
        billing_request.get("metadata") or {},
        (billing_request.get("mandate_request") or {}).get("metadata") or {},
        (billing_request.get("payment_request") or {}).get("metadata") or {},
    ]
    for meta in candidates:
        value = meta.get("renewal_subscription_id") if isinstance(meta, dict) else None
        if value:
            return str(value)
    return None


def _extract_mandate_id_from_billing_request(billing_request: dict[str, Any]) -> str | None:
    links = billing_request.get("links") or {}
    return links.get("mandate_request_mandate") or links.get("mandate")


def _process_subscription_renewal(
    supabase_admin: Client,
    subscription_id: str,
    new_mandate_id: str,
) -> None:
    """
    Cierra el ciclo de renovación: enlaza el nuevo mandato a la suscripción
    existente, crea una Subscription nueva en GoCardless y deja la comunidad
    en estado operativo.

    El primer cobro de la nueva Subscription compensa el mes adeudado: NO
    emitimos un payment one-off adicional para evitar el doble cargo (un
    cobro por la deuda + el primer cobro de la sub nueva).

    Idempotente: si la cs_row ya tiene el mandato nuevo, salimos.
    """
    cs_res = supabase_admin.table("community_subscriptions").select("*").eq("id", subscription_id).limit(1).execute()
    if not cs_res.data:
        logger.warning("Renovación: cs %s no encontrada en BD", subscription_id)
        return

    cs = cs_res.data[0]
    if cs.get("gocardless_mandate_id") == new_mandate_id:
        logger.info("Renovación de %s ya procesada (mandate=%s)", subscription_id, new_mandate_id)
        return

    association_id = str(cs["association_id"])

    amount_cents = int(cs.get("current_amount_cents") or 0)
    if amount_cents <= 0:
        plan_res = (
            supabase_admin.table("subscription_plans")
            .select("base_cents, per_household_cents")
            .eq("id", cs.get("subscription_plan_id"))
            .limit(1)
            .execute()
        )
        if plan_res.data:
            plan = plan_res.data[0]
            household_count = int(
                ((_load_association(supabase_admin, association_id) or {}).get("household_count")) or 0
            )
            amount_cents = int(plan["base_cents"]) + int(plan["per_household_cents"]) * household_count

    if amount_cents <= 0:
        logger.error(
            "Renovación de %s sin importe calculable; abortando para no crear sub a 0",
            subscription_id,
        )
        return

    association = _load_association(supabase_admin, association_id) or {}
    association_name = association.get("name") or "Comunidad"

    new_customer_id: str | None = None
    try:
        mandate = get_mandate(new_mandate_id)
        new_customer_id = (mandate.get("links") or {}).get("customer")
    except Exception:
        logger.exception("Renovación de %s: no se pudo leer el mandato %s", subscription_id, new_mandate_id)

    old_gc_sub_id = cs.get("gocardless_subscription_id")
    if old_gc_sub_id:
        try:
            cancel_subscription(
                old_gc_sub_id,
                metadata={"reason": "renewal", "subscription_id": subscription_id},
                idempotency_key=f"renew-cancel-{old_gc_sub_id}",
            )
        except Exception:
            logger.exception(
                "Renovación de %s: no se pudo cancelar subscription antigua %s en GoCardless",
                subscription_id,
                old_gc_sub_id,
            )

    try:
        new_gc_sub = create_subscription(
            mandate_id=new_mandate_id,
            amount_cents=amount_cents,
            name=f"Vecinus - {association_name}",
            metadata={
                "association_id": association_id,
                "subscription_id": subscription_id,
                "renewal_for_old_subscription": old_gc_sub_id or "",
            },
            idempotency_key=f"renew-sub-{subscription_id}-{new_mandate_id}",
        )
    except Exception:
        logger.exception(
            "Renovación de %s falló al crear subscription en GoCardless contra mandato %s",
            subscription_id,
            new_mandate_id,
        )
        return

    supabase_admin.table("community_subscriptions").update(
        {
            "gocardless_mandate_id": new_mandate_id,
            "gocardless_customer_id": new_customer_id,
            "gocardless_subscription_id": new_gc_sub.get("id"),
            "mandate_status": "active",
            "status": "active",
            "last_failure_at": None,
            "cancelled_at": None,
            "failure_count": 0,
            "current_amount_cents": amount_cents,
            "updated_at": _now_iso(),
        }
    ).eq("id", subscription_id).execute()

    _ensure_usage_counters_initialized(supabase_admin, subscription_id)


def _handle_mandate_active(supabase_admin: Client, event: dict[str, Any]) -> None:
    links = event.get("links") or {}
    mandate_id = links.get("mandate")
    if not mandate_id:
        return

    supabase_admin.table("community_subscriptions").update({"mandate_status": "active", "updated_at": _now_iso()}).eq(
        "gocardless_mandate_id", mandate_id
    ).execute()

    supabase_admin.table("registration_payment_orders").update({"status": "authorised", "updated_at": _now_iso()}).eq(
        "mandate_id", mandate_id
    ).execute()


def _handle_mandate_blocking(supabase_admin: Client, event: dict[str, Any]) -> None:
    links = event.get("links") or {}
    mandate_id = links.get("mandate")
    if not mandate_id:
        return

    sub = _load_subscription_by_mandate(supabase_admin, mandate_id)
    if not sub:
        logger.warning("mandate %s blocking event for unknown subscription", mandate_id)
        return

    _set_subscription_status(
        supabase_admin,
        sub["id"],
        "mandate_invalid",
        extra={
            "mandate_status": event.get("action"),
            "last_failure_at": _now_iso(),
        },
    )


def _handle_subscription_created(supabase_admin: Client, event: dict[str, Any]) -> None:
    links = event.get("links") or {}
    gc_sub_id = links.get("subscription")
    if not gc_sub_id:
        return
    logger.info("subscriptions.created received for %s (informative)", gc_sub_id)


def _handle_subscription_payment_created(supabase_admin: Client, event: dict[str, Any]) -> None:
    """Crea la fila de subscription_invoices en estado 'pending_submission'."""
    links = event.get("links") or {}
    payment_id = links.get("payment")
    gc_sub_id = links.get("subscription")
    if not payment_id or not gc_sub_id:
        return

    sub = _load_subscription_by_gocardless_id(supabase_admin, gc_sub_id)
    if not sub:
        logger.warning("subscriptions.payment_created for unknown subscription %s", gc_sub_id)
        return

    _upsert_invoice_from_payment(
        supabase_admin,
        payment_id=payment_id,
        subscription_row=sub,
        new_status="pending_submission",
    )


def _handle_subscription_cancelled(supabase_admin: Client, event: dict[str, Any]) -> None:
    links = event.get("links") or {}
    gc_sub_id = links.get("subscription")
    if not gc_sub_id:
        return

    sub = _load_subscription_by_gocardless_id(supabase_admin, gc_sub_id)
    if not sub:
        logger.warning("subscriptions.%s for unknown subscription %s", event.get("action"), gc_sub_id)
        return

    _set_subscription_status(
        supabase_admin,
        sub["id"],
        "cancelled",
        extra={"cancelled_at": _now_iso()},
    )


def _resolve_subscription_for_payment(
    supabase_admin: Client, payment_id: str
) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    """
    Devuelve (subscription_row, payment_dict). Primero busca la invoice local;
    si no existe, hace GET a GoCardless para descubrir la subscription.
    """
    invoice = _load_invoice_by_payment_id(supabase_admin, payment_id)
    if invoice:
        sub_res = (
            supabase_admin.table("community_subscriptions")
            .select("*")
            .eq("id", invoice["community_subscription_id"])
            .limit(1)
            .execute()
        )
        return (_first(sub_res.data), None)

    try:
        payment = get_payment(payment_id)
    except Exception:
        logger.exception("Could not GET /payments/%s", payment_id)
        return (None, None)

    gc_sub_id = (payment.get("links") or {}).get("subscription")
    if not gc_sub_id:
        return (None, payment)

    return (_load_subscription_by_gocardless_id(supabase_admin, gc_sub_id), payment)


def _handle_payment_confirmed(supabase_admin: Client, event: dict[str, Any]) -> None:
    payment_id = (event.get("links") or {}).get("payment")
    if not payment_id:
        return

    subscription, payment_dict = _resolve_subscription_for_payment(supabase_admin, payment_id)
    if not subscription:
        logger.warning("payments.confirmed for unknown subscription (payment=%s)", payment_id)
        return

    previous_invoice = _load_invoice_by_payment_id(supabase_admin, payment_id)
    previous_status = previous_invoice.get("status") if previous_invoice else None
    has_usage_counters = _usage_counters_exist(supabase_admin, str(subscription["id"]))

    _upsert_invoice_from_payment(
        supabase_admin,
        payment_id=payment_id,
        subscription_row=subscription,
        new_status="confirmed",
        payment_dict=payment_dict,
    )

    _set_subscription_status(
        supabase_admin,
        subscription["id"],
        "active",
        extra={"failure_count": 0, "last_payment_at": _now_iso()},
    )
    if _should_reset_usage_on_payment_confirmed(previous_status, has_usage_counters):
        _ensure_usage_counters_initialized(supabase_admin, str(subscription["id"]))


def _handle_payment_paid_out(supabase_admin: Client, event: dict[str, Any]) -> None:
    payment_id = (event.get("links") or {}).get("payment")
    if not payment_id:
        return
    subscription, payment_dict = _resolve_subscription_for_payment(supabase_admin, payment_id)
    if not subscription:
        return
    _upsert_invoice_from_payment(
        supabase_admin,
        payment_id=payment_id,
        subscription_row=subscription,
        new_status="paid_out",
        payment_dict=payment_dict,
    )


def _extract_failure_reason(event: dict[str, Any]) -> str | None:
    details = event.get("details") or {}
    return details.get("description") or details.get("cause") or details.get("reason_code")


def _handle_payment_failed(supabase_admin: Client, event: dict[str, Any]) -> None:
    payment_id = (event.get("links") or {}).get("payment")
    if not payment_id:
        return

    subscription, payment_dict = _resolve_subscription_for_payment(supabase_admin, payment_id)
    if not subscription:
        logger.warning("payments.%s for unknown subscription (payment=%s)", event.get("action"), payment_id)
        return

    failure_reason = _extract_failure_reason(event)

    _upsert_invoice_from_payment(
        supabase_admin,
        payment_id=payment_id,
        subscription_row=subscription,
        new_status="failed",
        failure_reason=failure_reason,
        payment_dict=payment_dict,
    )

    _set_subscription_status(
        supabase_admin,
        subscription["id"],
        "past_due",
        extra={
            "last_failure_at": _now_iso(),
            "failure_count": int(subscription.get("failure_count") or 0) + 1,
        },
    )

    _notify_admin_of_payment_failure(supabase_admin, subscription, failure_reason)


def _handle_payment_charged_back(supabase_admin: Client, event: dict[str, Any]) -> None:
    payment_id = (event.get("links") or {}).get("payment")
    if not payment_id:
        return

    subscription, payment_dict = _resolve_subscription_for_payment(supabase_admin, payment_id)
    if not subscription:
        return

    failure_reason = _extract_failure_reason(event) or event.get("action")

    _upsert_invoice_from_payment(
        supabase_admin,
        payment_id=payment_id,
        subscription_row=subscription,
        new_status="charged_back",
        failure_reason=failure_reason,
        payment_dict=payment_dict,
    )

    _set_subscription_status(
        supabase_admin,
        subscription["id"],
        "suspended",
        extra={"last_failure_at": _now_iso()},
    )

    _notify_admin_of_payment_failure(supabase_admin, subscription, failure_reason)


def _notify_admin_of_payment_failure(
    supabase_admin: Client,
    subscription: dict[str, Any],
    failure_reason: str | None,
) -> None:
    association_id = str(subscription["association_id"])
    association = _load_association(supabase_admin, association_id) or {}
    try:
        send_payment_failed_email(
            supabase_admin=supabase_admin,
            association_id=association_id,
            association_name=association.get("name", "tu comunidad"),
            amount_cents=int(subscription.get("current_amount_cents") or 0),
            currency="EUR",
            failure_reason=failure_reason,
        )
    except Exception:
        # Nunca dejar que un fallo de email rompa el procesado del evento.
        logger.exception("send_payment_failed_email raised for association %s", association_id)


def _dispatch_event(supabase_admin: Client, stored_event: dict[str, Any]) -> None:
    """
    Despacha un evento ya almacenado al handler correspondiente.
    `stored_event` es la fila de `dev_s2.gocardless_webhook_events`. El payload
    completo está en `raw_payload`.
    """
    payload = stored_event.get("raw_payload") or {}
    resource_type = stored_event.get("resource_type") or payload.get("resource_type")
    action = stored_event.get("action") or payload.get("action")

    if resource_type == "billing_requests" and action == "fulfilled":
        return _handle_billing_request_fulfilled(supabase_admin, payload)

    if resource_type == "mandates":
        if action == "active":
            return _handle_mandate_active(supabase_admin, payload)
        if action in _BLOCKING_MANDATE_ACTIONS:
            return _handle_mandate_blocking(supabase_admin, payload)
        return None

    if resource_type == "subscriptions":
        if action == "created":
            return _handle_subscription_created(supabase_admin, payload)
        if action == "payment_created":
            return _handle_subscription_payment_created(supabase_admin, payload)
        if action in {"cancelled", "finished"}:
            return _handle_subscription_cancelled(supabase_admin, payload)
        return None

    if resource_type == "payments":
        if action == "confirmed":
            return _handle_payment_confirmed(supabase_admin, payload)
        if action == "paid_out":
            return _handle_payment_paid_out(supabase_admin, payload)
        if action in _BLOCKING_PAYMENT_ACTIONS:
            return _handle_payment_failed(supabase_admin, payload)
        if action in _CHARGEBACK_ACTIONS:
            return _handle_payment_charged_back(supabase_admin, payload)
        return None

    logger.info(
        "Unhandled GoCardless event (%s, %s) id=%s — skipped",
        resource_type,
        action,
        stored_event.get("id"),
    )


def _mark_processed(supabase_admin: Client, event_id: str) -> None:
    supabase_admin.table("gocardless_webhook_events").update({"processed_at": _now_iso(), "processing_error": None}).eq(
        "id", event_id
    ).execute()


def _mark_failed(supabase_admin: Client, event_row: dict[str, Any], error: str) -> None:
    supabase_admin.table("gocardless_webhook_events").update(
        {
            "attempts": int(event_row.get("attempts") or 0) + 1,
            "processing_error": error[:1000],
        }
    ).eq("id", event_row["id"]).execute()


def process_pending_events(
    supabase_admin: Client | None = None,
    batch_size: int = 100,
) -> dict[str, int]:
    """
    Lee eventos sin `processed_at` y los procesa secuencialmente.

    Diseñada para ser invocada vía `BackgroundTasks` después de cada hit del
    webhook, y también (en futuras iteraciones) desde un cron de barrido.

    Devuelve estadísticas: {"total": N, "ok": K, "failed": F, "skipped": S}.
    Nunca lanza excepciones — toda excepción se atrapa por evento.
    """
    if supabase_admin is None:
        supabase_admin = get_supabase_admin()

    try:
        res = (
            supabase_admin.table("gocardless_webhook_events")
            .select("*")
            .is_("processed_at", "null")
            .order("received_at")
            .limit(batch_size)
            .execute()
        )
    except Exception:
        logger.exception("Failed to fetch pending gocardless webhook events")
        return {"total": 0, "ok": 0, "failed": 0, "skipped": 0}

    events = res.data or []
    stats = {"total": len(events), "ok": 0, "failed": 0, "skipped": 0}

    for event_row in events:
        try:
            _dispatch_event(supabase_admin, event_row)
        except Exception as exc:
            stats["failed"] += 1
            logger.exception(
                "Error processing gocardless event id=%s (%s, %s)",
                event_row.get("id"),
                event_row.get("resource_type"),
                event_row.get("action"),
            )
            try:
                _mark_failed(supabase_admin, event_row, str(exc))
            except Exception:
                logger.exception("Could not mark event %s as failed", event_row.get("id"))
            continue

        try:
            _mark_processed(supabase_admin, event_row["id"])
            stats["ok"] += 1
        except Exception:
            logger.exception("Could not mark event %s as processed", event_row.get("id"))
            stats["skipped"] += 1

    if stats["total"]:
        logger.info(
            "Webhook worker: processed %d events (ok=%d failed=%d skipped=%d)",
            stats["total"],
            stats["ok"],
            stats["failed"],
            stats["skipped"],
        )
    return stats
