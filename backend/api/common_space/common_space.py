from typing import List
from uuid import UUID

from api.chat.chat_helpers import verify_association_membership
from core.deps import get_current_user, get_supabase, get_supabase_admin
from fastapi import APIRouter, Depends, HTTPException, Response, UploadFile, status
from schemas.common_space import CommonSpace, CommonSpaceCreate, CommonSpaceUpdate
from services.common_space.common_space_service import (
    create_common_space as create_common_space_service,
    delete_common_space as delete_common_space_service,
    get_common_space_by_id as get_common_space_by_id_service,
    list_common_spaces as list_common_spaces_service,
    update_common_space as update_common_space_service,
    upload_common_space_photo as upload_common_space_photo_service,
)
from supabase import Client

router = APIRouter(prefix="/common-spaces", tags=["common_spaces"])


def verify_association_admin_or_president(association_id: UUID, user_id: str, supabase: Client) -> dict:
    membership_res = (
        supabase.table("memberships")
        .select("association_id, role")
        .eq("profile_id", str(user_id))
        .execute()
    )

    target_association_id = str(association_id)
    membership = next(
        (
            item
            for item in (membership_res.data or [])
            if str(item.get("association_id")) == target_association_id
        ),
        None,
    )

    if not membership:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta comunidad")

    role = str(membership.get("role"))
    if role not in {"1", "4"}:
        raise HTTPException(status_code=403, detail="Se requiere rol de administrador o presidente para esta acción")

    return membership


@router.post("/upload-photo")
async def upload_common_space_photo_endpoint(
    file: UploadFile,
    current_user: dict = Depends(get_current_user),
):
    del current_user

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Solo se permiten subidas de imágenes")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="El archivo subido está vacío")

    return upload_common_space_photo_service(file_bytes, file.filename or "common-space", file.content_type)


@router.post("/{association_id}", response_model=CommonSpace, status_code=status.HTTP_201_CREATED)
def create_common_space_endpoint(
    association_id: UUID,
    payload: CommonSpaceCreate,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    verify_association_admin_or_president(association_id, current_user["id"], supabase)
    return create_common_space_service(supabase_admin, payload, association_id)


@router.get("/{association_id}", response_model=List[CommonSpace])
def list_common_spaces_endpoint(
    association_id: UUID,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    verify_association_membership(association_id, current_user["id"], supabase)
    return list_common_spaces_service(supabase, association_id)


@router.get("/{association_id}/{common_space_id}", response_model=CommonSpace)
def get_common_space_endpoint(
    association_id: UUID,
    common_space_id: int,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    verify_association_membership(association_id, current_user["id"], supabase)
    return get_common_space_by_id_service(supabase, association_id, common_space_id)


@router.put("/{association_id}/{common_space_id}", response_model=CommonSpace)
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


@router.delete("/{association_id}/{common_space_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_common_space_endpoint(
    association_id: UUID,
    common_space_id: int,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
    supabase_admin: Client = Depends(get_supabase_admin),
):
    verify_association_admin_or_president(association_id, current_user["id"], supabase)
    delete_common_space_service(supabase_admin, association_id, common_space_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
