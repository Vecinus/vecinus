from datetime import datetime, timedelta, timezone
from typing import List

from core.deps import get_current_user, get_supabase, get_supabase_admin, get_supabase_anon
from fastapi import APIRouter, Depends, HTTPException
from schemas.associations import (
    AcceptInvitationRequest,
    CommunityUser,
    InvitationResponse,
    InviteAdminRequest,
    InviteTenantRequest,
    MembershipWithCommunity,
)
from services.email_service import ROLE_LABELS, send_invitation_email
from supabase import Client

router = APIRouter()


@router.get("/users/me/communities", response_model=List[MembershipWithCommunity])
def get_my_communities(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    user_id = current_user["id"]
    response = (
        supabase.table("memberships")
        .select("id, association_id, role, property_id, joined_at, neighborhood_associations(id, name, address)")
        .eq("profile_id", user_id)
        .execute()
    )
    return response.data


@router.post("/invite/admin", response_model=InvitationResponse)
def invite_admin(
    body: InviteAdminRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    if body.role_to_grant == 1:
        raise HTTPException(status_code=400, detail="Cannot grant ADMIN role via invitation")

    # Comprobar que el usuario es admin (role=1) de la asociación
    membership = (
        supabase.table("memberships")
        .select("role")
        .eq("profile_id", current_user["id"])
        .eq("association_id", str(body.association_id))
        .eq("role", 1)
        .execute()
    )
    if not membership.data:
        raise HTTPException(status_code=403, detail="Admin access required for this action")

    # --- NUEVA VALIDACIÓN: Evitar invitaciones duplicadas ---
    existing_invitation = (
        supabase_admin.table("invitations")
        .select("id")
        .eq("target_email", body.target_email)
        .eq("association_id", str(body.association_id))
        .eq("status", 1)  # 1 = PENDING
        .execute()
    )

    if existing_invitation.data:
        raise HTTPException(
            status_code=400, detail="Este correo ya tiene una invitación pendiente para esta comunidad."
        )
    # --------------------------------------------------------

    insert_data = {
        "target_email": body.target_email,
        "association_id": str(body.association_id),
        "role_to_grant": body.role_to_grant,
        "invited_by_profile_id": current_user["id"],
        "status": 1,  # PENDING
    }

    if getattr(body, "property_id", None):
        insert_data["property_id"] = str(body.property_id)

    result = supabase_admin.table("invitations").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create invitation")

    invitation = result.data[0]
    role_label = ROLE_LABELS.get(body.role_to_grant, "Miembro")
    auth_users = supabase_admin.auth.admin.list_users()
    registered_emails = [user.email for user in auth_users]
    if body.target_email not in registered_emails:
        send_invitation_email(body.target_email, str(invitation["id"]), role_label)

    return invitation


@router.post("/invite/tenant", response_model=InvitationResponse)
def invite_tenant(
    body: InviteTenantRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    # Comprobar que el usuario es owner (role=2) de la propiedad en esa asociación
    membership = (
        supabase.table("memberships")
        .select("role")
        .eq("profile_id", current_user["id"])
        .eq("association_id", str(body.association_id))
        .eq("property_id", str(body.property_id))
        .eq("role", 2)
        .execute()
    )
    if not membership.data:
        raise HTTPException(status_code=403, detail="Property owner access required for this action")

    result = (
        supabase_admin.table("invitations")
        .insert(
            {
                "target_email": body.target_email,
                "association_id": str(body.association_id),
                "property_id": str(body.property_id),
                "role_to_grant": 3,  # TENANT
                "invited_by_profile_id": current_user["id"],
                "status": 1,  # PENDING
            }
        )
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create invitation")

    invitation = result.data[0]

    auth_users = supabase_admin.auth.admin.list_users()
    registered_emails = [user.email for user in auth_users]

    if body.target_email not in registered_emails:
        send_invitation_email(body.target_email, str(invitation["id"]), ROLE_LABELS[3])

    return invitation


@router.post("/auth/accept-invitation")
def accept_invitation(
    body: AcceptInvitationRequest,
    supabase_anon: Client = Depends(get_supabase_anon),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    # 1. Leer invitación PENDING por token
    try:
        inv_res = (
            supabase_anon.table("invitations")
            .select("*")
            .eq("id", str(body.invitation_token))
            .eq("status", 1)
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=400, detail="El formato del token de invitación es inválido.")

    if not inv_res.data:
        raise HTTPException(status_code=404, detail="La invitación no existe o ya ha sido utilizada")

    invitation = inv_res.data[0]

    # 2. Comprobar caducidad de 24 horas
    if "created_at" in invitation and invitation["created_at"]:
        created_at = datetime.fromisoformat(invitation["created_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > created_at + timedelta(hours=24):
            (supabase_admin.table("invitations").update({"status": 3}).eq("id", str(body.invitation_token)).execute())
            raise HTTPException(
                status_code=400,
                detail="La invitación ha caducado (pasaron más de 24 horas)",
            )

    # 3. Flujo Inteligente: Autenticación
    user_id = None
    is_new_user = False
    access_token = None

    try:
        # A. Intentamos Iniciar Sesión (El usuario YA existe y puso su contraseña correcta)
        auth_response = supabase_anon.auth.sign_in_with_password(
            {"email": invitation["target_email"], "password": body.password}
        )
        user_id = str(auth_response.user.id)
        if auth_response.session:
            access_token = auth_response.session.access_token

    except Exception:
        # B. Si falla, creamos el usuario usando el ADMIN CLIENT para saltarnos el Rate Limit
        try:
            # admin.create_user ignora los límites de correo y auto-confirma la cuenta
            new_user = supabase_admin.auth.admin.create_user(
                {"email": invitation["target_email"], "password": body.password, "email_confirm": True}
            )

            user_id = str(new_user.user.id)
            is_new_user = True

            # Como admin.create_user solo lo crea pero no inicia sesión, iniciamos sesión ahora para obtener el token
            login_response = supabase_anon.auth.sign_in_with_password(
                {"email": invitation["target_email"], "password": body.password}
            )
            if login_response.session:
                access_token = login_response.session.access_token

        except Exception as signup_error:
            # C. Si falla el registro admin, significa que el usuario YA existía pero se equivocó de contraseña
            raise HTTPException(
                status_code=400, detail=f"La contraseña es incorrecta o hubo un error: {str(signup_error)}"
            )

    # 4. Configurar perfiles y membresías (Envuelto en try-catch para capturar el Error 500)
    try:
        # Crear perfil si es un usuario nuevo
        if is_new_user:
            supabase_admin.table("profiles").upsert(
                {
                    "id": user_id,
                    "username": invitation["target_email"].split("@")[0],
                }
            ).execute()

        # Crear la membresía en la comunidad
        membership_data = {
            "profile_id": user_id,
            "association_id": str(invitation["association_id"]),
            "role": invitation["role_to_grant"],
        }
        if invitation.get("property_id"):
            membership_data["property_id"] = str(invitation["property_id"])

        # Comprobamos si ya es miembro para no generar errores de duplicidad
        existing_member = (
            supabase_admin.table("memberships")
            .select("id")
            .eq("profile_id", user_id)
            .eq("association_id", membership_data["association_id"])
            .execute()
        )

        if not existing_member.data:
            supabase_admin.table("memberships").insert(membership_data).execute()

        # Marcar invitación como ACCEPTED
        (supabase_admin.table("invitations").update({"status": 2}).eq("id", str(body.invitation_token)).execute())

    except Exception as db_error:
        # Este es el log que te revelará la causa si vuelve a fallar la BD
        raise HTTPException(status_code=500, detail=f"Error interno configurando la comunidad: {str(db_error)}")

    return {
        "message": "Invitación aceptada con éxito",
        "user_id": user_id,
        "is_new_user": is_new_user,
        "token": access_token,
    }


@router.get("/users/me/invitations")
def get_my_pending_invitations(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Obtiene las invitaciones pendientes del usuario logueado usando su email."""
    # current_user suele contener el email en supabase auth. Si no, sácalo de la tabla profiles.
    user_email = current_user.get("email")

    # Buscamos invitaciones PENDING (status=1) para este email
    response = (
        supabase.table("invitations")
        .select("id, role_to_grant, created_at, neighborhood_associations(name)")
        .eq("target_email", user_email)
        .eq("status", 1)
        .execute()
    )

    # Formatear la respuesta para el frontend
    invitations = []
    for inv in response.data:
        community = inv.get("neighborhood_associations") or {}
        invitations.append(
            {
                "id": inv["id"],
                "communityName": community.get("name", "Comunidad Desconocida"),
                "roleId": inv["role_to_grant"],
                "roleName": ROLE_LABELS.get(inv["role_to_grant"], "Miembro"),
                "date": inv["created_at"],
            }
        )

    return invitations


@router.post("/invitations/{invitation_id}/accept")
def accept_invitation_internal(
    invitation_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    """Acepta una invitación cuando el usuario YA está dentro de la app."""
    user_email = current_user.get("email")
    user_id = current_user.get("id")

    # Verificar que la invitación existe, es para este usuario y está pendiente
    inv_res = supabase.table("invitations").select("*").eq("id", invitation_id).eq("status", 1).execute()

    if not inv_res.data:
        raise HTTPException(status_code=404, detail="Invitación no encontrada o ya procesada")

    invitation = inv_res.data[0]

    if invitation["target_email"] != user_email:
        raise HTTPException(status_code=403, detail="No tienes permiso para aceptar esta invitación")

    # 1. Crear la membresía
    membership_data = {
        "profile_id": user_id,
        "association_id": str(invitation["association_id"]),
        "role": invitation["role_to_grant"],
    }
    if invitation.get("property_id"):
        membership_data["property_id"] = str(invitation["property_id"])

    # Evitar duplicidad si ya existe
    existing = (
        supabase.table("memberships")
        .select("id")
        .eq("profile_id", user_id)
        .eq("association_id", membership_data["association_id"])
        .execute()
    )
    if not existing.data:
        supabase_admin.table("memberships").insert(membership_data).execute()

    # 2. Marcar invitación como ACCEPTED (status = 2)
    supabase_admin.table("invitations").update({"status": 2}).eq("id", invitation_id).execute()

    return {"message": "Has entrado a la comunidad exitosamente"}


@router.post("/invitations/{invitation_id}/reject")
def reject_invitation_internal(
    invitation_id: str,
    current_user: dict = Depends(get_current_user),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    """Rechaza la invitación marcándola con status 3"""
    user_email = current_user.get("email")

    inv_res = supabase_admin.table("invitations").select("target_email, status").eq("id", invitation_id).execute()

    if not inv_res.data:
        raise HTTPException(status_code=404, detail="La invitación no existe")

    invitation = inv_res.data[0]

    if invitation["target_email"] != user_email:
        raise HTTPException(status_code=403, detail="Acceso denegado. Esta invitación no es para ti.")

    if invitation["status"] != 1:
        raise HTTPException(status_code=400, detail="Esta invitación ya fue procesada anteriormente.")

    try:
        supabase_admin.table("invitations").update({"status": 3}).eq("id", invitation_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al actualizar la base de datos: {str(e)}")

    return {"message": "Invitación rechazada"}


@router.delete("/members/{membership_id}")
def delete_member(
    membership_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    membership_res = supabase.table("memberships").select("*").eq("id", membership_id).execute()
    if not membership_res.data:
        raise HTTPException(status_code=404, detail="Membership not found")

    membership_to_delete = membership_res.data[0]
    association_id = membership_to_delete["association_id"]

    admin_check = (
        supabase.table("memberships")
        .select("role")
        .eq("profile_id", current_user["id"])
        .eq("association_id", association_id)
        .execute()
    )

    is_admin = admin_check.data and admin_check.data[0].get("role") == 1

    # Opcional: Permitir que un usuario se borre a sí mismo de la comunidad
    is_self = membership_to_delete["profile_id"] == current_user["id"]

    if not is_admin and not is_self:
        raise HTTPException(status_code=403, detail="Admin access required for this action")

    try:
        delete_res = supabase_admin.table("memberships").delete().eq("id", membership_id).execute()

        if not delete_res.data:
            raise HTTPException(status_code=500, detail="No se pudo eliminar el registro de la base de datos")

    except Exception:
        raise HTTPException(status_code=500, detail="Database error")

    return {"message": f"Membership {membership_id} deleted successfully"}


@router.get("/{association_id}/users", response_model=List[CommunityUser])
def get_community_users(
    association_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """
    Obtiene todos los usuarios miembros de una comunidad específica.
    """
    response = (
        supabase.table("memberships")
        .select("id,role, profiles(id, username)")
        .eq("association_id", association_id)
        .execute()
    )

    if not response.data:
        return []

    users_list = []
    for item in response.data:
        profile = item.get("profiles") or {}
        if profile.get("id"):
            users_list.append(
                {
                    "id": profile.get("id"),
                    "membership_id": item.get("id"),
                    "username": profile.get("username"),
                    "role": item.get("role"),
                }
            )

    return users_list


@router.get("/{association_id}/properties/available")
def get_available_properties(
    association_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    properties_res = supabase.table("properties").select("id, number").eq("association_id", association_id).execute()

    memberships_res = (
        supabase.table("memberships")
        .select("property_id")
        .eq("association_id", association_id)
        .not_.is_("property_id", "null")
        .execute()
    )

    assigned_property_ids = {m["property_id"] for m in memberships_res.data}

    # Filtrar solo las que están libres
    available_properties = [p for p in properties_res.data if p["id"] not in assigned_property_ids]

    return available_properties


@router.get("/{association_id}/invitations/pending")
def get_pending_community_invitations(
    association_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),  # <-- 1. Añadimos el admin client aquí
):
    """
    Obtiene todas las invitaciones pendientes (status=1) para una comunidad específica.
    Solo accesible para Administradores o Presidentes.
    """
    admin_check = (
        supabase.table("memberships")
        .select("role")
        .eq("profile_id", current_user["id"])
        .eq("association_id", association_id)
        .execute()
    )

    is_admin = admin_check.data and admin_check.data[0].get("role") in [1, 4]

    if not is_admin:
        raise HTTPException(status_code=403, detail="Admin access required for this action")

    # 2. Usamos supabase_admin para leer la tabla sin que el RLS nos bloquee
    response = (
        supabase_admin.table("invitations")
        .select("id, target_email, role_to_grant, created_at, property_id")
        .eq("association_id", association_id)
        .eq("status", 1)  # 1 = PENDING
        .order("created_at", desc=True)
        .execute()
    )

    return response.data
