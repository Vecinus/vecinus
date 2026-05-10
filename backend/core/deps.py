import base64
import json
import logging
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, ClientOptions, create_client

from .config import settings

logger = logging.getLogger(__name__)

# Authentication scheme
security = HTTPBearer()

ACTIVE_SUBSCRIPTION_STATUSES = frozenset({"active", "pending_first_payment"})

_ASSOCIATION_PATH_PARAM_NAMES = (
    "association_id",
    "comunidad_id",
    "community_id",
)


def _normalize_supabase_key(value: str) -> str:
    return value.strip().strip('"').strip("'")


def _extract_jwt_role(value: str) -> str | None:
    payload = _extract_jwt_payload(value)
    if not payload:
        return None
    return payload.get("role")


def _extract_jwt_payload(value: str) -> dict | None:
    parts = value.split(".")
    if len(parts) != 3:
        return None

    payload = parts[1]
    padding = "=" * (-len(payload) % 4)

    try:
        decoded_payload = base64.urlsafe_b64decode(payload + padding).decode("utf-8")
        return json.loads(decoded_payload)
    except (ValueError, json.JSONDecodeError):
        return None


def _is_privileged_supabase_key(value: str) -> bool:
    normalized_value = _normalize_supabase_key(value)
    if not normalized_value:
        return False

    if normalized_value.startswith("sb_secret_"):
        return True

    return _extract_jwt_role(normalized_value) == "service_role"


def get_supabase_admin_key() -> str:
    service_key = _normalize_supabase_key(settings.SUPABASE_SERVICE_KEY)
    project_key = _normalize_supabase_key(settings.SUPABASE_KEY)

    if _is_privileged_supabase_key(service_key):
        return service_key

    if _is_privileged_supabase_key(project_key):
        return project_key

    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Supabase admin client is misconfigured. Set a secret or service_role key.",
    )


def get_supabase(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Client:
    """Cliente Supabase autenticado con el JWT del usuario (respeta RLS)."""
    token = credentials.credentials
    options = ClientOptions(schema=settings.SUPABASE_SCHEMA)
    client: Client = create_client(
        settings.SUPABASE_URL,
        _normalize_supabase_key(settings.SUPABASE_KEY),
        options=options,
    )

    client.postgrest.auth(token)
    return client


def get_supabase_anon() -> Client:
    """Cliente anon para endpoints publicos (ej: aceptar invitacion)."""
    options = ClientOptions(schema=settings.SUPABASE_SCHEMA)
    return create_client(
        settings.SUPABASE_URL,
        _normalize_supabase_key(settings.SUPABASE_KEY),
        options=options,
    )


def get_supabase_admin() -> Client:
    """Cliente con service role para operaciones que bypasean RLS."""
    options = ClientOptions(schema=settings.SUPABASE_SCHEMA)
    return create_client(settings.SUPABASE_URL, get_supabase_admin_key(), options=options)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Valida el JWT localmente y extrae datos del usuario."""
    token = credentials.credentials
    try:
        payload = _extract_jwt_payload(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )

        user_id = payload.get("sub")
        user_role = payload.get("role")
        user_email = payload.get("email")
        exp = payload.get("exp")

        if not user_id or user_role != "authenticated":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )

        if exp is not None:
            expiration = datetime.fromtimestamp(int(exp), tz=timezone.utc)
            if expiration <= datetime.now(timezone.utc):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token expired",
                )

        return {
            "id": str(user_id),
            "role": str(user_role),
            "email": user_email,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )


def _extract_association_id_from_path(request: Request) -> str | None:
    for name in _ASSOCIATION_PATH_PARAM_NAMES:
        value = request.path_params.get(name)
        if value:
            return str(value)
    return None


def check_subscription_active(supabase_admin: Client, association_id: str) -> str:
    """
    Helper público con la lógica de validación de suscripción.

    Lo extraemos de `require_active_community` para que las dependencies que
    derivan el `association_id` por otras vías (p. ej. lookup channel→asoc en
    chat) puedan reutilizarlo sin duplicar la query ni los mensajes de error.

    Lanza HTTP 402 si la comunidad no tiene fila de suscripción o si su
    estado no está en `ACTIVE_SUBSCRIPTION_STATUSES`. Devuelve la propia
    `association_id` cuando todo está OK, para encadenarla en deps.
    """
    res = (
        supabase_admin.table("community_subscriptions")
        .select("status, gocardless_subscription_id, last_failure_at, cancelled_at")
        .eq("association_id", association_id)
        .limit(1)
        .execute()
    )

    if not res.data:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "community_no_subscription",
                "reason": "no_subscription_found",
                # Mensaje neutro respecto al rol: el frontend (modal de bloqueo)
                # añade el call-to-action en función del rol del usuario.
                "message": "Esta comunidad no tiene una suscripción asociada.",
                "association_id": association_id,
            },
        )

    sub = res.data[0]
    sub_status = sub.get("status")
    if sub_status not in ACTIVE_SUBSCRIPTION_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={
                "code": "community_blocked",
                "reason": f"subscription_{sub_status}",
                # Mensaje neutro respecto al rol: el frontend (modal de bloqueo)
                # añade el call-to-action en función del rol del usuario.
                "message": "La comunidad está bloqueada por impago.",
                "association_id": association_id,
                "since": sub.get("last_failure_at") or sub.get("cancelled_at"),
            },
        )

    return association_id


def require_active_community(
    request: Request,
    supabase_admin: Client = Depends(get_supabase_admin),
) -> str:
    """
    Dependency que bloquea cualquier operación dentro de una comunidad cuya
    suscripción no esté al corriente de pago.

    Lee `association_id` (o `comunidad_id` / `community_id`) del path de la
    request y delega la validación en `check_subscription_active`.

    Aislamiento por comunidad: la dependencia se ejecuta sólo sobre el
    `association_id` de la request actual; comunidades distintas del mismo
    usuario no se ven afectadas entre sí.
    """
    association_id = _extract_association_id_from_path(request)
    if not association_id:
        # Bug del programador: el endpoint usa esta dependency pero su path
        # no expone ningún parámetro asociación. Mejor 500 explícito que
        # silenciosamente permitir el paso.
        logger.error(
            "require_active_community attached to a route without an association id path param: %s",
            request.url.path,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No association_id found in request path",
        )

    return check_subscription_active(supabase_admin, association_id)


def require_active_community_for_channel(
    request: Request,
    supabase_admin: Client = Depends(get_supabase_admin),
) -> str | None:
    """
    Variante de `require_active_community` para endpoints del chat que llevan
    `channel_id` en el path (no `association_id`).

    Resolución: lookup en `chat_channels(id) → association_id`. Si la fila no
    existe (canal inválido) NO lanzamos 402 — dejamos que el endpoint
    produzca su 404 natural. Si el canal es DM sin `association_id` (mensajería
    directa entre usuarios fuera del contexto de comunidad), saltamos la
    validación: ese chat no está sujeto a la facturación de la suscripción.
    """
    channel_id = request.path_params.get("channel_id")
    if not channel_id:
        logger.error(
            "require_active_community_for_channel attached to a route without channel_id: %s",
            request.url.path,
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No channel_id found in request path",
        )

    res = (
        supabase_admin.table("chat_channels")
        .select("association_id, is_direct_message")
        .eq("id", str(channel_id))
        .limit(1)
        .execute()
    )

    if not res.data:
        # Canal no existe → que el endpoint maneje el 404. Si bloquearamos con
        # 402 confundiríamos el diagnóstico al usuario.
        return None

    association_id = res.data[0].get("association_id")
    if not association_id:
        # DM sin contexto de comunidad: no aplica el bloqueo por suscripción.
        return None

    return check_subscription_active(supabase_admin, str(association_id))
