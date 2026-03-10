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
    send_invitation_email(body.target_email, str(invitation["id"]), ROLE_LABELS[3])

    return invitation


@router.post("/auth/accept-invitation")
def accept_invitation(
    body: AcceptInvitationRequest,
    supabase_anon: Client = Depends(get_supabase_anon),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    # 1. Leer invitación PENDING por token
    inv_res = (
        supabase_anon.table("invitations").select("*").eq("id", str(body.invitation_token)).eq("status", 1).execute()
    )
    if not inv_res.data:
        raise HTTPException(status_code=404, detail="La invitación no existe o ya ha sido utilizada")

    invitation = inv_res.data[0]

    # 2. Comprobar caducidad de 24 horas
    if "created_at" in invitation and invitation["created_at"]:
        created_at = datetime.fromisoformat(invitation["created_at"].replace("Z", "+00:00"))
        if datetime.now(timezone.utc) > created_at + timedelta(hours=24):
            # Marcar como expirada (opcional, status = 3)
            (supabase_admin.table("invitations").update({"status": 3}).eq("id", str(body.invitation_token)).execute())
            raise HTTPException(
                status_code=400,
                detail="La invitación ha caducado (pasaron más de 24 horas)",
            )

    # 3. Flujo Inteligente: Autenticación
    user_id = None
    is_new_user = False

    try:
        # A. Intentamos Iniciar Sesión (El usuario YA existe y puso su contraseña correcta)
        auth_response = supabase_anon.auth.sign_in_with_password(
            {"email": invitation["target_email"], "password": body.password}
        )
        user_id = str(auth_response.user.id)
    except Exception:
        # B. Si falla, intentamos Registrarlo (El usuario es NUEVO)
        try:
            auth_response = supabase_anon.auth.sign_up({"email": invitation["target_email"], "password": body.password})
            if not auth_response.user:
                raise HTTPException(status_code=500, detail="Error al crear la cuenta")

            user_id = str(auth_response.user.id)
            is_new_user = True
        except Exception:  # <-- AQUÍ ESTABA EL ERROR (borrado el 'as e')
            # C. Si falla el registro, significa que el usuario YA existe pero se equivocó
            raise HTTPException(
                status_code=400,
                detail="Este correo ya tiene cuenta en VecinUs. La contraseña es incorrecta.",
            )

    # 4. Crear perfil si es un usuario nuevo
    if is_new_user:
        supabase_admin.table("profiles").upsert(
            {
                "id": user_id,
                "username": invitation["target_email"].split("@")[0],
            }
        ).execute()

    # 5. Crear la membresía en la comunidad
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

    # 6. Marcar invitación como ACCEPTED
    (supabase_admin.table("invitations").update({"status": 2}).eq("id", str(body.invitation_token)).execute())

    return {
        "message": "Invitación aceptada con éxito",
        "user_id": user_id,
        "is_new_user": is_new_user,
    }


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
