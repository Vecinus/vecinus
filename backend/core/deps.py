import base64
import json
import logging

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


def _verify_jwt_hs256(token: str) -> dict | None:
    """Intenta validar un JWT con HS256 usando SUPABASE_JWT_SECRET.

    Devuelve el payload si la verificación tiene éxito, None si el secreto no
    está configurado o el token no es HS256. Lanza HTTPException si el token es
    HS256 pero está expirado.
    """
    jwt_secret = _normalize_supabase_key(settings.SUPABASE_JWT_SECRET)
    if not jwt_secret:
        return None

    try:
        return pyjwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["sub", "exp", "role"]},
        )
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )
    except pyjwt.InvalidTokenError:
        return None


def _verify_jwt_with_supabase(token: str) -> dict:
    """Valida JWTs firmados asimétricamente (ES256/RS256) mediante el JWKS de Supabase."""
    options = ClientOptions(schema=settings.SUPABASE_SCHEMA)
    client = create_client(
        settings.SUPABASE_URL,
        _normalize_supabase_key(settings.SUPABASE_KEY),
        options=options,
    )
    claims_response = client.auth.get_claims(token)
    if not claims_response:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    claims = claims_response.get("claims") or {}
    if not claims.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    return dict(claims)


def _verify_jwt(token: str) -> dict:
    """Verifica la firma del JWT y devuelve el payload.

    Soporta tanto JWTs HS256 (legacy) firmados con SUPABASE_JWT_SECRET como
    JWTs firmados asimétricamente (ES256/RS256) usando el JWKS de Supabase.
    """
    try:
        header = pyjwt.get_unverified_header(token)
    except pyjwt.DecodeError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )

    if header.get("alg") == "HS256":
        payload = _verify_jwt_hs256(token)
        if payload is not None:
            return payload

    try:
        return _verify_jwt_with_supabase(token)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Asymmetric JWT verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )


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
