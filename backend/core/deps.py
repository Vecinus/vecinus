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
    options = ClientOptions(schema=settings.SUPABASE_SCHEMA)
    client: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY, options=options)

    client.postgrest.auth(token)
    return client


def get_supabase_anon() -> Client:
    """Cliente anon para endpoints públicos (ej: aceptar invitación)."""
    options = ClientOptions(schema=settings.SUPABASE_SCHEMA)
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY, options=options)


def get_supabase_admin() -> Client:
    """Cliente con service role para operaciones que bypasean RLS."""
    options = ClientOptions(schema=settings.SUPABASE_SCHEMA)
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY, options=options)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """Valida el JWT contra Supabase Auth y extrae datos del usuario."""
    token = credentials.credentials
    try:
        client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_KEY,
            options=ClientOptions(schema=settings.SUPABASE_SCHEMA),
        )
        user_response = client.auth.get_user(token)

        if not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )

        user = user_response.user

        if user.role != "authenticated":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )

        return {
            "id": str(user.id),
            "role": user.role,
            "email": user.email,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )
