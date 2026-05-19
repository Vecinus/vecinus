from typing import List
from uuid import UUID

from api.chat.chat_helpers import (
    verify_association_admin_or_president,
    verify_association_membership,
)
from core.deps import get_current_user, get_supabase, get_supabase_admin, require_active_community
from fastapi import APIRouter, Depends, Response, status
from schemas.common_space import CommonSpace, CommonSpaceCreate, CommonSpaceUpdate
from services.common_space.common_space_service import create_common_space as create_common_space_service
from services.common_space.common_space_service import delete_common_space as delete_common_space_service
from services.common_space.common_space_service import get_common_space_by_id as get_common_space_by_id_service
from services.common_space.common_space_service import list_common_spaces as list_common_spaces_service
from services.common_space.common_space_service import update_common_space as update_common_space_service
from supabase import Client

router = APIRouter(prefix="/common-spaces", tags=["common_spaces"])


@router.post(
    "/{association_id}",
    response_model=CommonSpace,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_active_community)],
)
def create_common_space_endpoint(
    association_id: UUID,
    payload: CommonSpaceCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    verify_association_admin_or_president(association_id, current_user["id"], supabase)
    return create_common_space_service(supabase_admin, payload, association_id)


@router.get(
    "/{association_id}",
    response_model=List[CommonSpace],
    dependencies=[Depends(require_active_community)],
)
def list_common_spaces_endpoint(
    association_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    verify_association_membership(association_id, current_user["id"], supabase)
    return list_common_spaces_service(supabase, association_id)


@router.get(
    "/{association_id}/{common_space_id}",
    response_model=CommonSpace,
    dependencies=[Depends(require_active_community)],
)
def get_common_space_endpoint(
    association_id: UUID,
    common_space_id: int,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    verify_association_membership(association_id, current_user["id"], supabase)
    return get_common_space_by_id_service(supabase, association_id, common_space_id)


@router.put(
    "/{association_id}/{common_space_id}",
    response_model=CommonSpace,
    dependencies=[Depends(require_active_community)],
)
def update_common_space_endpoint(
    association_id: UUID,
    common_space_id: int,
    payload: CommonSpaceUpdate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    verify_association_admin_or_president(association_id, current_user["id"], supabase)
    return update_common_space_service(supabase_admin, association_id, common_space_id, payload)


@router.delete(
    "/{association_id}/{common_space_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_active_community)],
)
def delete_common_space_endpoint(
    association_id: UUID,
    common_space_id: int,
    force: bool = False,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    verify_association_admin_or_president(association_id, current_user["id"], supabase)
    delete_common_space_service(supabase_admin, association_id, common_space_id, force=force)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
