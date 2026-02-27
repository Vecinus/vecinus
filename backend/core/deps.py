from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client, ClientOptions
from .config import settings

# Authentication scheme
security = HTTPBearer()

def get_supabase(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Client:
    """Dependency para inyectar el cliente de Supabase autenticado con el rol del usuario."""
    token = credentials.credentials
    options = ClientOptions(schema="dev")
    client: Client = create_client(
        settings.SUPABASE_URL, 
        settings.SUPABASE_KEY, 
        options=options
    )

    client.postgrest.auth(token)
    return client

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Dependency para obtener la info del usuario desde el JWT sin consultar repetidamente la DB."""
    import jwt
    token = credentials.credentials
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        
        user_id = payload.get("sub")
        role = payload.get("role")
        
        if not user_id or role != "authenticated":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
            
        return {
            "id": user_id,
            "role": role,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )
