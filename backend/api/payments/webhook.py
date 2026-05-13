import json
import logging

from core.deps import get_supabase_admin
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, Response, status
from services.payments.gocardless_service import verify_webhook_signature
from services.payments.webhook_service import process_pending_events
from supabase import Client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/payments/gocardless", tags=["payments-webhook"])


def _is_unique_violation(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "23505" in msg or "duplicate key" in msg or "duplicate" in msg


@router.post("/webhook")
async def gocardless_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    webhook_signature: str | None = Header(None, alias="Webhook-Signature"),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    """
    Endpoint público del webhook de GoCardless.

    Sprint B (sólo): valida la firma HMAC-SHA256 sobre el body raw, parsea el
    payload y persiste cada evento de forma idempotente en
    `dev_s2.gocardless_webhook_events`. Devuelve 204 No Content. El procesado
    de la lógica de negocio (transiciones de estado de suscripciones, bloqueos)
    se implementa en sprints posteriores leyendo de esa misma tabla.
    """
    raw_body = await request.body()

    if not verify_webhook_signature(raw_body, webhook_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON body",
        )

    events = payload.get("events", [])
    if not isinstance(events, list):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Malformed payload: 'events' must be a list",
        )

    for event in events:
        if not isinstance(event, dict):
            continue

        event_id = event.get("id")
        resource_type = event.get("resource_type")
        action = event.get("action")
        if not event_id or not resource_type or not action:
            logger.warning("Skipping malformed webhook event: %r", event)
            continue

        record = {
            "provider_event_id": event_id,
            "resource_type": resource_type,
            "action": action,
            "raw_payload": event,
        }

        try:
            supabase_admin.table("gocardless_webhook_events").insert(record).execute()
        except Exception as exc:
            if _is_unique_violation(exc):
                # Evento ya recibido anteriormente (reentrega de GoCardless)
                logger.info("Duplicate gocardless event ignored: %s", event_id)
                continue
            logger.exception("Failed to persist gocardless webhook event %s", event_id)
            # 5xx -> GoCardless reintentará con backoff. Es lo que queremos en
            # caso de fallo transitorio de DB.
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to persist webhook event",
            ) from exc

    # Procesado asíncrono diferido. Se ejecuta DESPUÉS de devolver la respuesta
    # 204, así GoCardless no penaliza por latencia. El worker construye su
    # propio supabase_admin para que su ciclo de vida no dependa del request.
    background_tasks.add_task(process_pending_events)

    return Response(status_code=status.HTTP_204_NO_CONTENT)
