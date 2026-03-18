from typing import List
from uuid import UUID

from api.chat.chat_helpers import verify_association_membership
from core.deps import get_current_user, get_supabase
from fastapi import APIRouter, Depends, HTTPException, Response, status
from schemas.common_space import CommonSpace, CommonSpaceCreate, CommonSpaceUpdate
from services.common_space.common_space_service import (
    create_common_space,
    delete_common_space,
    get_common_space_by_id,
    list_common_spaces,
    update_common_space,
)
from supabase import Client

router = APIRouter(prefix="/common-spaces", tags=["common_spaces"])


def verify_association_admin_or_president(association_id: UUID, user_id: str, supabase: Client) -> dict:
    membership_res = (
        supabase.table("memberships")
        .select("role")
        .eq("association_id", str(association_id))
        .eq("profile_id", str(user_id))
        .limit(1)
        .execute()
    )

    if not membership_res.data:
        raise HTTPException(status_code=404, detail="Membership not found in this community")

    role = str(membership_res.data[0].get("role"))
    if role not in {"1", "4"}:
        raise HTTPException(status_code=403, detail="Admin or president access required for this action")

    return membership_res.data[0]


@router.post("/{association_id}", response_model=CommonSpace, status_code=status.HTTP_201_CREATED)
def create_common_space(
    association_id: UUID,
    payload: CommonSpaceCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    verify_association_admin_or_president(association_id, current_user["id"], supabase)
    return create_common_space(supabase, association_id, payload)


@router.get("/{association_id}", response_model=List[CommonSpace])
def list_common_spaces(
    association_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    verify_association_membership(association_id, current_user["id"], supabase)
    return list_common_spaces(supabase, association_id)


@router.get("/{association_id}/{common_space_id}", response_model=CommonSpace)
def get_common_space(
    association_id: UUID,
    common_space_id: int,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    verify_association_membership(association_id, current_user["id"], supabase)
    return get_common_space_by_id(supabase, association_id, common_space_id)


@router.put("/{association_id}/{common_space_id}", response_model=CommonSpace)
def update_common_space(
    association_id: UUID,
    common_space_id: int,
    payload: CommonSpaceUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    verify_association_admin_or_president(association_id, current_user["id"], supabase)
    return update_common_space(supabase, association_id, common_space_id, payload)


@router.delete("/{association_id}/{common_space_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_common_space(
    association_id: UUID,
    common_space_id: int,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    verify_association_admin_or_president(association_id, current_user["id"], supabase)
    delete_common_space(supabase, association_id, common_space_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
