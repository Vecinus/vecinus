from core.deps import get_supabase_anon
from fastapi import APIRouter, Depends, HTTPException
from schemas.auth.auth import UserLogin
from supabase import Client

router = APIRouter()


@router.post("/login")
def login(user: UserLogin, supabase: Client = Depends(get_supabase_anon)):
    try:
        session = supabase.auth.sign_in_with_password({"email": user.email, "password": user.password})
        return session
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error at login: {str(e)}")
