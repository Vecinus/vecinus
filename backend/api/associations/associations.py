from typing import List

from core.config import settings
from core.deps import get_current_user, get_supabase, get_supabase_admin, get_supabase_anon
from fastapi import APIRouter, Depends, HTTPException
from postgrest.exceptions import APIError
from schemas.associations import (
    AcceptInvitationRequest,
    CommunityUser,
    InvitationResponse,
    InviteAdminRequest,
    InviteTenantRequest,
    MembershipWithCommunity,
)
from services.email_service import ROLE_LABELS, send_invitation_email
from supabase import Client, ClientOptions, create_client

router = APIRouter()


@router.get("/users/me/communities", response_model=List[MembershipWithCommunity])
def get_my_communities(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    user_id = current_user["id"]
    response = (
        supabase.table("memberships")
        .select("id, association_id, role, property_id, joined_at," " neighborhood_associations(id, name, address)")
        .eq("profile_id", user_id)
        .execute()
    )
    return response.data


@router.post("/invite/admin", response_model=InvitationResponse)
def invite_admin(
    body: InviteAdminRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    if body.role_to_grant == 1:
        raise HTTPException(status_code=400, detail="Cannot grant ADMIN role via invitation")

    try:
        result = (
            supabase.table("invitations")
            .insert(
                {
                    "target_email": body.target_email,
                    "association_id": str(body.association_id),
                    "role_to_grant": body.role_to_grant,
                    "invited_by_profile_id": current_user["id"],
                    "status": 1,  # PENDING
                }
            )
            .execute()
        )
    except APIError as e:
        if e.code == "42501":
            raise HTTPException(status_code=403, detail="Admin access required for this action")
        raise HTTPException(status_code=500, detail="Database error")

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
):
    try:
        result = (
            supabase.table("invitations")
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
    except APIError as e:
        if e.code == "42501":
            raise HTTPException(
                status_code=403,
                detail="Property owner access required for this action",
            )
        raise HTTPException(status_code=500, detail="Database error")

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create invitation")

    invitation = result.data[0]
    send_invitation_email(body.target_email, str(invitation["id"]), ROLE_LABELS[3])

    return invitation


@router.post("/auth/accept-invitation")
def accept_invitation(
    body: AcceptInvitationRequest,
    supabase_anon: Client = Depends(get_supabase_anon),
):
    # 1. Leer invitación PENDING por token (RLS anon policy lo permite)
    inv_res = (
        supabase_anon.table("invitations").select("*").eq("id", str(body.invitation_token)).eq("status", 1).execute()
    )
    if not inv_res.data:
        raise HTTPException(status_code=404, detail="Invitation not found or already used")

    invitation = inv_res.data[0]

    # 2. Registrar usuario: email de la invitación,
    # contraseña del usuario
    auth_response = supabase_anon.auth.sign_up(
        {
            "email": invitation["target_email"],
            "password": body.password,
        }
    )

    if not auth_response.user:
        raise HTTPException(status_code=500, detail="Failed to create user account")

    if not auth_response.session:
        raise HTTPException(
            status_code=400,
            detail=("Email confirmation required." " Ask your admin to disable email confirmations."),
        )

    # 3. Cliente user-scoped con la sesión recién creada (RLS aplica)
    user_client = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_KEY,
        options=ClientOptions(schema=settings.SUPABASE_SCHEMA),
    )
    user_client.postgrest.auth(auth_response.session.access_token)

    user_id = str(auth_response.user.id)

    # 4. Crear perfil (RLS: auth.uid() = id)
    user_client.table("profiles").insert(
        {
            "id": user_id,
            "username": invitation["target_email"].split("@")[0],
        }
    ).execute()

    # 5. Crear membresía (RLS: profile_id = auth.uid() + invitación pendiente)
    membership_data = {
        "profile_id": user_id,
        "association_id": str(invitation["association_id"]),
        "role": invitation["role_to_grant"],
    }
    if invitation.get("property_id"):
        membership_data["property_id"] = str(invitation["property_id"])

    user_client.table("memberships").insert(membership_data).execute()

    # 6. Marcar invitación como ACCEPTED (RLS: target_email = auth.email())
    user_client.table("invitations").update({"status": 2}).eq("id", str(body.invitation_token)).execute()

    return {"message": "Invitation accepted", "user_id": user_id}


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

    Args:
        association_id: ID de la comunidad/asociación
        current_user: Usuario actual autenticado
        supabase: Cliente de Supabase con RLS

    Returns:
        Lista con ID, nombre de usuario y rol de cada miembro
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
    # Obtener todas las propiedades de la comunidad
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
