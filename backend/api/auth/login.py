from datetime import datetime, timezone

from core.deps import get_current_user, get_supabase_admin, get_supabase_anon
from fastapi import APIRouter, Depends, HTTPException, status
from schemas.auth.auth import UserLogin, UserRegister
from supabase import Client
from supabase_auth.errors import AuthApiError

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    user: UserRegister,
    supabase_anon: Client = Depends(get_supabase_anon),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    user_id = None
    try:
        response = supabase_anon.auth.sign_up({"email": user.email, "password": user.password})

        if not response.user:
            raise HTTPException(status_code=400, detail="Error al crear el usuario")

        user_id = response.user.id

        profile_data = {
            "id": str(user_id),
            "email": user.email,
            "username": user.username,
            "avatar_url": None,
            "created_at": datetime.utcnow().isoformat(),
        }

        profile_response = supabase_admin.table("profiles").insert(profile_data).execute()

        if not profile_response.data:
            raise HTTPException(status_code=500, detail="Error al crear el perfil del usuario")

        return {
            "message": "Usuario registrado exitosamente",
            "user_id": str(user_id),
            "email": response.user.email,
            "username": profile_data["username"],
            "needs_email_confirmation": response.user.email_confirmed_at is None,
        }
    except Exception as e:
        # Rollback: si se creó en auth pero falló el perfil, eliminamos el usuario
        if user_id:
            try:
                supabase_admin.auth.admin.delete_user(str(user_id))
            except Exception as rollback_error:
                print(f"Failed to delete user on rollback: {rollback_error}")

        if isinstance(e, HTTPException):
            raise

        if isinstance(e, AuthApiError):
            if e.code == "user_already_exists":
                raise HTTPException(status_code=409, detail="El email ya está registrado")
            if e.code == "weak_password":
                raise HTTPException(status_code=400, detail="La contraseña es muy débil")
            raise HTTPException(status_code=400, detail=f"Error al registrar: {str(e)}")

        error_msg = str(e)
        if "profiles_username_key" in error_msg or "23505" in error_msg:
            raise HTTPException(status_code=409, detail="El nombre de usuario ya está en uso")
        raise HTTPException(status_code=500, detail=f"Error interno al registrar: {error_msg}")


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
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error at logout: {str(exc)}")


@router.post("/remove")
def remove_account(
    confirmation: UserLogin,
    current_user: dict = Depends(get_current_user),
    supabase_anon: Client = Depends(get_supabase_anon),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    try:
        current_email = (current_user.get("email") or "").lower()
        current_id = current_user.get("id")

        if not current_email or not current_id:
            raise HTTPException(status_code=401, detail="No authenticated user found")

        if confirmation.email.lower() != current_email:
            raise HTTPException(status_code=403, detail="El email no coincide con el usuario autenticado")

        auth_check = supabase_anon.auth.sign_in_with_password(
            {"email": current_email, "password": confirmation.password}
        )

        if not getattr(auth_check, "user", None) or str(auth_check.user.id) != str(current_id):
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")

        profile = supabase_admin.table("profiles").select("*").eq("id", str(current_id)).single().execute()
        profile_data = profile.data
        if not profile_data or len(profile_data) == 0:
            raise HTTPException(status_code=404, detail="Perfil de usuario no encontrado")
        updated_profile = (
            supabase_admin.table("profiles")
            .update(
                {
                    "username": f"Deleted User {current_id}",
                    "avatar_url": None,
                    "email": f"deleted_{current_id}@deleted.com",
                    "deleted_at": datetime.now(tz=timezone.utc).isoformat(),
                },
            )
            .eq("id", str(current_id))
            .execute()
        )
        if (
            not updated_profile.data
            or len(updated_profile.data) == 0
            or updated_profile.data[0].get("username") != f"Deleted User {current_id}"
            or updated_profile.data[0].get("email") != f"deleted_{current_id}@deleted.com"
            or not updated_profile.data[0].get("deleted_at")
        ):
            raise HTTPException(status_code=500, detail="Error al anonimizar el perfil del usuario")
        supabase_admin.auth.admin.update_user_by_id(str(current_id), {"email": f"deleted_{current_id}@deleted.com"})

        return {"id": str(current_id)}
    except HTTPException:
        raise
    except AuthApiError as aae:
        if aae.code == "invalid_credentials":
            raise HTTPException(status_code=401, detail="Credenciales incorrectas")
        raise HTTPException(status_code=500, detail=f"Error de autenticacion con Supabase: {str(aae)}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Database error at account removal: {str(exc)}")
