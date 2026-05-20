from typing import List
from uuid import UUID

from fastapi import HTTPException
from schemas.common_space import CommonSpaceCreate, CommonSpaceUpdate
from supabase import Client

TABLE_NAME = "common_space"
RESERVATION_TABLE = "reservation"
GUEST_PASS_TABLE = "guest_pass"  # nosec B105 nosemgrep — nombre de tabla, no credencial


def _validate_common_space_time_window(space_data: dict) -> None:
    start_time = space_data.get("start_time")
    end_time = space_data.get("end_time")
    if start_time and end_time and str(start_time) >= str(end_time):
        raise HTTPException(status_code=422, detail="start_time must be before end_time")


def create_common_space(supabase: Client, payload: CommonSpaceCreate, association_id: UUID) -> dict:
    insert_data = payload.model_dump(exclude_none=True, mode="json")
    insert_data["association_id"] = str(association_id)

    response = supabase.table(TABLE_NAME).insert(insert_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="No se ha podido crear la zona común")

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
        raise HTTPException(status_code=404, detail="No se ha encontrado la zona común")

    return response.data[0]


def update_common_space(
    supabase: Client, association_id: UUID, common_space_id: int, payload: CommonSpaceUpdate
) -> dict:
    update_data = payload.model_dump(exclude_none=True, mode="json")
    if not update_data:
        raise HTTPException(status_code=400, detail="No se han proporcionado campos para actualizar")

    current = get_common_space_by_id(supabase, association_id, common_space_id)
    merged_data = {**current, **update_data}
    _validate_common_space_time_window(merged_data)

    response = (
        supabase.table(TABLE_NAME)
        .update(update_data)
        .eq("association_id", str(association_id))
        .eq("id", common_space_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="No se ha encontrado la zona común")

    return response.data[0]


def delete_common_space(supabase: Client, association_id: UUID, common_space_id: int, force: bool = False) -> None:
    existing = (
        supabase.table(TABLE_NAME)
        .select("id")
        .eq("association_id", str(association_id))
        .eq("id", common_space_id)
        .limit(1)
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=404, detail="No se ha encontrado la zona común")

    reservations = (
        supabase.table(RESERVATION_TABLE).select("id", count="exact").eq("space_id", common_space_id).execute()
    )
    reservation_count = reservations.count or 0

    if reservation_count > 0 and not force:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "common_space_has_reservations",
                "message": "La zona común tiene reservas hechas por vecinos",
                "reservation_count": reservation_count,
            },
        )

    if force:
        supabase.table(RESERVATION_TABLE).delete().eq("space_id", common_space_id).execute()
        supabase.table(GUEST_PASS_TABLE).delete().eq("space_id", common_space_id).execute()

    response = (
        supabase.table(TABLE_NAME)
        .delete()
        .eq("association_id", str(association_id))
        .eq("id", common_space_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="No se ha encontrado la zona común")
