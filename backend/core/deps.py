from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import create_client, Client, ClientOptions
from .config import settings

# Initialize Supabase client targeting the 'dev' schema by default
options = ClientOptions(schema="dev")
supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY, options=options)

# Authentication scheme
security = HTTPBearer()

def get_supabase() -> Client:
    """Dependency para inyectar el cliente de Supabase."""
    return supabase

def get_admin_supabase() -> Client:
    """Dependency para inyectar el cliente admin de Supabase con permisos (RLS bypass)."""
    admin_options = ClientOptions(schema="dev")
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY, options=admin_options)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Dependency para validar el token JWT y obtener el usuario actual desde el esquema dev.profiles."""
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
            
        admin_supabase = get_admin_supabase()
        
        profile_res = admin_supabase.table("profiles").select("*").eq("id", user_id).execute()
        
        if not profile_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User profile not found",
            )
            
        return profile_res.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )
