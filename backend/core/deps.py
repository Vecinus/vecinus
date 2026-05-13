import base64
import json
import logging
from datetime import datetime, timezone

import jwt as pyjwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, ClientOptions, create_client

from .config import settings

logger = logging.getLogger(__name__)

# Authentication scheme
security = HTTPBearer()
security_optional = HTTPBearer(auto_error=False)


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


def _verify_jwt(token: str) -> dict:
    """Verifica la firma del JWT y devuelve el payload. Lanza excepción si falla."""
    jwt_secret = settings.SUPABASE_JWT_SECRET

    if jwt_secret:
        try:
            payload = pyjwt.decode(
                token,
                jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={"require": ["sub", "exp", "role"]},
            )
            return payload
        except pyjwt.ExpiredSignatureError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token expired",
            )
        except pyjwt.InvalidTokenError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
    else:
        logger.warning("SUPABASE_JWT_SECRET not configured — falling back to unverified JWT decode")
        payload = _extract_jwt_payload(token)
        if not payload:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
        return payload


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Valida el JWT (con firma si SUPABASE_JWT_SECRET está configurado) y extrae datos del usuario."""
    token = credentials.credentials
    try:
        payload = _verify_jwt(token)

        user_id = payload.get("sub")
        user_role = payload.get("role")
        user_email = payload.get("email")

        if not user_id or user_role != "authenticated":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )

        return {
            "id": str(user_id),
            "role": str(user_role),
            "email": user_email,
        }

    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_optional),
) -> dict | None:
    """Extrae datos del usuario si está autenticado, sino retorna None."""
    if not credentials:
        return None

    token = credentials.credentials
    try:
        payload = _verify_jwt(token)

        user_id = payload.get("sub")
        user_role = payload.get("role")
        user_email = payload.get("email")

        if not user_id or user_role != "authenticated":
            return None

        return {
            "id": str(user_id),
            "role": str(user_role),
            "email": user_email,
        }

    except Exception:
        return None
