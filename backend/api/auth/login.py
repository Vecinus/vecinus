import logging
from datetime import datetime, timezone

from core.deps import get_current_user, get_supabase_admin, get_supabase_anon
from fastapi import APIRouter, Depends, HTTPException, status
from schemas.auth.auth import UserLogin, UserRecover, UserRegister
from supabase import Client
from supabase_auth.errors import AuthApiError

logger = logging.getLogger(__name__)

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
            "avatar_url": user.avatar_url,
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
                logger.error("Failed to delete user on rollback: %s", rollback_error)

        if isinstance(e, HTTPException):
            raise

        if isinstance(e, AuthApiError):
            if e.code == "user_already_exists":
                raise HTTPException(status_code=409, detail="El email ya está registrado")
            if e.code == "weak_password":
                raise HTTPException(status_code=400, detail="La contraseña es muy débil")
            if e.code == "over_email_send_rate_limit":
                raise HTTPException(
                    status_code=429, detail="Se han enviado demasiados correos. Inténtalo de nuevo en unos minutos."
                )
            if e.code == "signup_disabled":
                raise HTTPException(
                    status_code=403, detail="El registro de nuevos usuarios está deshabilitado temporalmente."
                )
            logger.error("Supabase AuthApiError durante registro: code=%s msg=%s", e.code, e.message)
            raise HTTPException(status_code=400, detail=f"Error al registrar el usuario: {e.message}")

        error_msg = str(e)
        if "profiles_username_key" in error_msg or "23505" in error_msg:
            raise HTTPException(status_code=409, detail="El nombre de usuario ya está en uso")
        logger.error("Error interno al registrar: %s", error_msg)
        raise HTTPException(status_code=500, detail="Error interno al registrar")


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
        raise HTTPException(status_code=500, detail="Error de autenticación")
    except Exception:
        raise HTTPException(status_code=500, detail="Error interno al iniciar sesión")


@router.post("/logout")
def logout(supabase: Client = Depends(get_supabase_anon)):
    try:
        supabase.auth.sign_out()
        return {"message": "Logged out successfully"}
    except Exception:
        raise HTTPException(status_code=500, detail="Error al cerrar sesión")


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
            raise HTTPException(status_code=403, detail="You can only delete your own account")

        auth_check = supabase_anon.auth.sign_in_with_password(
            {"email": current_email, "password": confirmation.password}
        )

        if not getattr(auth_check, "user", None) or str(auth_check.user.id) != str(current_id):
            raise HTTPException(status_code=401, detail="Wrong password")

        profile = supabase_admin.table("profiles").select("*").eq("id", str(current_id)).single().execute()
        profile_data = profile.data
        if not profile_data or len(profile_data) == 0:
            raise HTTPException(status_code=404, detail="User profile not found")
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
            raise HTTPException(status_code=500, detail="Error deleting user profile")
        supabase_admin.auth.admin.update_user_by_id(str(current_id), {"email": f"deleted_{current_id}@deleted.com"})

        return {"id": str(current_id)}
    except HTTPException:
        raise
    except AuthApiError as aae:
        if aae.code == "invalid_credentials":
            raise HTTPException(status_code=401, detail="Wrong supabase credentials")
        raise HTTPException(status_code=500, detail="Error de autenticación")
    except Exception:
        raise HTTPException(status_code=500, detail="Error interno al eliminar la cuenta")


@router.post("/recover")
def recover_account(
    account_id: str,
    password: str,
    supabase_anon: Client = Depends(get_supabase_anon),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    try:
        account = supabase_admin.auth.admin.get_user_by_id(account_id)
        account_user = getattr(account, "user", None)

        if not account_user:
            raise HTTPException(status_code=404, detail="User not found")

        login_attempt = supabase_anon.auth.sign_in_with_password({"email": account_user.email, "password": password})
        if not getattr(login_attempt, "user", None):
            raise HTTPException(status_code=401, detail="Wrong password")

        return {"message": "Account recovered successfully", "id": account_id}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error interno al recuperar la cuenta")


@router.post("/recover/unanonymize")
def set_recovered_account(
    user: UserRecover,
    supabase_anon: Client = Depends(get_supabase_anon),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    try:
        account = supabase_admin.auth.admin.get_user_by_id(user.id)
        account_user = getattr(account, "user", None)
        profile = supabase_admin.table("profiles").select("*").eq("id", user.id).single().execute()
        if not account_user or not profile.data:
            raise HTTPException(status_code=404, detail="User not found")
        elif (
            account_user.email != f"deleted_{user.id}@deleted.com"
            or profile.data.get("email") != f"deleted_{user.id}@deleted.com"
            or profile.data.get("username") != f"Deleted User {user.id}"
            or profile.data.get("deleted_at") is None
        ):
            raise HTTPException(status_code=409, detail="Account is not marked as deleted and cannot be recovered")
        check_password = supabase_anon.auth.sign_in_with_password(
            {"email": account_user.email, "password": user.password}
        )
        if not getattr(check_password, "user", None):
            raise HTTPException(status_code=401, detail="Wrong password")

        update_response = (
            supabase_admin.table("profiles")
            .update(
                {
                    "username": user.username,
                    "email": user.email,
                    "avatar_url": user.avatar_url,
                    "deleted_at": None,
                }
            )
            .eq("id", user.id)
            .execute()
        )

        if not update_response.data or len(update_response.data) == 0:
            raise HTTPException(status_code=500, detail="Error unanonymizing user profile")

        supabase_admin.auth.admin.update_user_by_id(user.id, {"email": user.email})
        final_login = supabase_anon.auth.sign_in_with_password({"email": user.email, "password": user.password})
        if not getattr(final_login, "user", None):
            raise HTTPException(status_code=500, detail="Failed to sign in with updated credentials")

        return {"message": "Account unanonymized successfully", "id": user.id}
    except HTTPException:
        raise
    except Exception as exc:
        error_msg = str(exc)
        if "profiles_username_key" in error_msg or "Key (username)=" in error_msg or "23505" in error_msg:
            raise HTTPException(status_code=409, detail="El nombre de usuario ya está en uso")
        raise HTTPException(status_code=500, detail="Error interno al recuperar la cuenta")
