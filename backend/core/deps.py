from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from supabase import Client, ClientOptions, create_client

from .config import settings

# Authentication scheme
security = HTTPBearer()


def get_supabase(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Client:
    """Cliente Supabase autenticado con el JWT del usuario (respeta RLS)."""
    token = credentials.credentials
    options = ClientOptions(schema="dev")
    client: Client = create_client(
        settings.SUPABASE_URL, settings.SUPABASE_KEY, options=options
    )

    client.postgrest.auth(token)
    return client


def get_supabase_anon() -> Client:
    """Cliente anon para endpoints públicos (ej: aceptar invitación)."""
    options = ClientOptions(schema="dev")
    return create_client(
        settings.SUPABASE_URL, settings.SUPABASE_KEY, options=options
    )


def get_supabase_admin() -> Client:
    """Cliente con service role para operaciones que bypasean RLS."""
    options = ClientOptions(schema="dev")
    return create_client(
        settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY, options=options
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Extrae datos del usuario desde el JWT sin consultar la DB."""
    import jwt

    token = credentials.credentials
    try:
        payload = jwt.decode(token, options={"verify_signature": False})

        user_id = payload.get("sub")
        role = payload.get("role")
        email = payload.get("email")

        if not user_id or role != "authenticated":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )

        return {
            "id": user_id,
            "role": role,
            "email": email,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )
