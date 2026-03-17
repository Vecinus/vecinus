from typing import List
from uuid import UUID

from fastapi import HTTPException
from schemas.common_space import CommonSpaceCreate, CommonSpaceUpdate
from supabase import Client

TABLE_NAME = "common_space"


def create_common_space(supabase: Client, association_id: UUID, payload: CommonSpaceCreate) -> dict:
    insert_data = payload.model_dump()
    insert_data["association_id"] = str(association_id)

    response = supabase.table(TABLE_NAME).insert(insert_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create common space")

    return response.data[0]


def list_common_spaces(supabase: Client, association_id: UUID) -> List[dict]:
    response = (
        supabase.table(TABLE_NAME)
        .select("*")
        .eq("association_id", str(association_id))
        .order("created_at", desc=True)
        .execute()
    )
    return response.data or []


def get_common_space_by_id(supabase: Client, association_id: UUID, common_space_id: int) -> dict:
    response = (
        supabase.table(TABLE_NAME)
        .select("*")
        .eq("association_id", str(association_id))
        .eq("id", common_space_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Common space not found")

    return response.data[0]


def update_common_space(supabase: Client, association_id: UUID, common_space_id: int, payload: CommonSpaceUpdate) -> dict:
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    response = (
        supabase.table(TABLE_NAME)
        .update(update_data)
        .eq("association_id", str(association_id))
        .eq("id", common_space_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Common space not found")

    return response.data[0]


def delete_common_space(supabase: Client, association_id: UUID, common_space_id: int) -> None:
    response = (
        supabase.table(TABLE_NAME)
        .delete()
        .eq("association_id", str(association_id))
        .eq("id", common_space_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Common space not found")
