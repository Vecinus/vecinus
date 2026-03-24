from core.deps import get_supabase_anon
from fastapi import APIRouter, Depends, HTTPException
from schemas.auth.auth import UserLogin
from supabase import Client
from supabase_auth.errors import AuthApiError

router = APIRouter()


@router.post("/login")
def login(user: UserLogin, supabase: Client = Depends(get_supabase_anon)):
    try:
        session = supabase.auth.sign_in_with_password({"email": user.email, "password": user.password})

        if not getattr(session, "session", None):
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")

        return session
    except HTTPException:
        raise
    except AuthApiError as aae:
        if aae.code == "invalid_credentials":
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")
        raise HTTPException(status_code=500, detail=f"Error de autenticacion con Supabase: {str(aae)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error interno al iniciar sesion: {str(e)}")


@router.post("/logout")
def logout(supabase: Client = Depends(get_supabase_anon)):
    try:
        supabase.auth.sign_out()
        return {"message": "Logged out successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error at logout: {str(e)}")
