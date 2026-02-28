from typing import List

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from api.chat_helpers import verify_community_admin, verify_property_owner
from core.deps import get_current_user, get_supabase, get_supabase_admin
from schemas.associations import (AcceptInvitationRequest, InvitationResponse,
                                  InviteAdminRequest, InviteTenantRequest,
                                  MembershipWithCommunity)

router = APIRouter()


@router.get("/users/me/communities", response_model=List[MembershipWithCommunity])
def get_my_communities(
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    user_id = current_user["id"]
    response = (
        supabase.table("memberships")
        .select(
            "id, association_id, role, property_id, joined_at, neighborhood_associations(id, name, address)"
        )
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
        raise HTTPException(
            status_code=400, detail="Cannot grant ADMIN role via invitation"
        )

    verify_community_admin(body.association_id, current_user["id"], supabase)

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

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create invitation")

    return result.data[0]


@router.post("/invite/tenant", response_model=InvitationResponse)
def invite_tenant(
    body: InviteTenantRequest,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    verify_property_owner(body.property_id, current_user["id"], supabase)

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

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create invitation")

    return result.data[0]


@router.post("/auth/accept-invitation")
def accept_invitation(
    body: AcceptInvitationRequest,
    supabase_admin: Client = Depends(get_supabase_admin),
):
    # 1. Buscar invitación PENDING por token
    inv_res = (
        supabase_admin.table("invitations")
        .select("*")
        .eq("id", str(body.invitation_token))
        .eq("status", 1)
        .execute()
    )
    if not inv_res.data:
        raise HTTPException(
            status_code=404, detail="Invitation not found or already used"
        )

    invitation = inv_res.data[0]

    # 2. Crear usuario en Supabase Auth
    auth_response = supabase_admin.auth.admin.create_user(
        {
            "email": invitation["target_email"],
            "password": body.password,
            "email_confirm": True,
        }
    )
    new_user = auth_response.user
    if not new_user:
        raise HTTPException(status_code=500, detail="Failed to create user account")

    user_id = str(new_user.id)

    # 3. Crear perfil
    supabase_admin.table("profiles").insert(
        {
            "id": user_id,
            "username": invitation["target_email"].split("@")[0],
        }
    ).execute()

    # 4. Crear membresía
    membership_data = {
        "profile_id": user_id,
        "association_id": str(invitation["association_id"]),
        "role": invitation["role_to_grant"],
    }
    if invitation.get("property_id"):
        membership_data["property_id"] = str(invitation["property_id"])

    supabase_admin.table("memberships").insert(membership_data).execute()

    # 5. Marcar invitación como ACCEPTED
    supabase_admin.table("invitations").update({"status": 2}).eq(
        "id", str(body.invitation_token)
    ).execute()

    return {"message": "Invitation accepted", "user_id": user_id}
