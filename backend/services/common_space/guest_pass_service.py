from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from schemas.common_space import GuestPassCreate
from supabase import Client

COMMON_SPACE_TABLE = "common_space"
GUEST_PASS_TABLE = "guest_pass"
PENDING_STATUS_ID = 1
CHECKED_IN_STATUS_ID = 2
CANCELLED_STATUS_ID = 3
GUEST_PASS_MODE = "guest_pass"
EMPLOYEE_ROLE_ID = "5"


def _get_common_space(supabase: Client, space_id: int) -> dict:
    response = (
        supabase.table(COMMON_SPACE_TABLE)
        .select("id, association_id, name, requires_qr, usage_mode")
        .eq("id", space_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="No se ha encontrado la zona comun")

    return response.data[0]


def _verify_employee_membership(supabase_admin: Client, association_id: str, user_id: str) -> None:
    membership_response = (
        supabase_admin.table("memberships")
        .select("role")
        .eq("association_id", association_id)
        .eq("profile_id", user_id)
        .limit(1)
        .execute()
    )

    if not membership_response.data:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta comunidad")

    if str(membership_response.data[0].get("role")) != EMPLOYEE_ROLE_ID:
        raise HTTPException(status_code=403, detail="Se requiere rol de empleado para validar el QR")


def create_guest_pass(supabase: Client, user_id: str, payload: GuestPassCreate) -> dict:
    space = _get_common_space(supabase, payload.space_id)
    if space.get("usage_mode") != GUEST_PASS_MODE:
        raise HTTPException(status_code=400, detail="Esta zona comun no admite pases de invitado")

    insert_data = {
        "user_id": user_id,
        "space_id": payload.space_id,
        "valid_for_date": payload.valid_for_date.isoformat(),
    }
    response = supabase.table(GUEST_PASS_TABLE).insert(insert_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="No se ha podido crear el pase de invitado")

    return response.data[0]


def list_user_guest_passes(supabase: Client, user_id: str, association_id: str) -> list[dict]:
    membership_response = (
        supabase.table("memberships")
        .select("profile_id")
        .eq("association_id", association_id)
        .eq("profile_id", user_id)
        .limit(1)
        .execute()
    )

    if not membership_response.data:
        raise HTTPException(status_code=403, detail="No tienes acceso a esta comunidad")

    guest_pass_response = (
        supabase.table(GUEST_PASS_TABLE)
        .select("id, user_id, space_id, valid_for_date, qr_token, status_id, checked_in_at, created_at")
        .eq("user_id", user_id)
        .neq("status_id", CANCELLED_STATUS_ID)
        .execute()
    )

    items = []
    for guest_pass in guest_pass_response.data or []:
        space = _get_common_space(supabase, int(guest_pass["space_id"]))
        if str(space["association_id"]) != association_id:
            continue

        items.append(
            {
                "id": guest_pass["id"],
                "user_id": guest_pass["user_id"],
                "space_id": guest_pass["space_id"],
                "space_name": space["name"],
                "association_id": space["association_id"],
                "requires_qr": bool(space.get("requires_qr")),
                "valid_for_date": guest_pass["valid_for_date"],
                "qr_token": guest_pass["qr_token"],
                "status_id": guest_pass["status_id"],
                "checked_in_at": guest_pass.get("checked_in_at"),
                "created_at": guest_pass.get("created_at"),
            }
        )

    items.sort(key=lambda item: (item["valid_for_date"], item["id"]))
    return items


def cancel_guest_pass(supabase: Client, user_id: str, guest_pass_id: int) -> dict:
    guest_pass_response = (
        supabase.table(GUEST_PASS_TABLE)
        .select("id, user_id, status_id")
        .eq("id", guest_pass_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    if not guest_pass_response.data:
        raise HTTPException(status_code=404, detail="No se ha encontrado el pase de invitado")

    guest_pass = guest_pass_response.data[0]
    if int(guest_pass.get("status_id", 0)) != PENDING_STATUS_ID:
        raise HTTPException(status_code=400, detail="Solo se pueden cancelar pases pendientes")

    (
        supabase.table(GUEST_PASS_TABLE)
        .delete()
        .eq("id", guest_pass_id)
        .eq("user_id", user_id)
        .eq("status_id", PENDING_STATUS_ID)
        .execute()
    )

    verification_response = (
        supabase.table(GUEST_PASS_TABLE).select("id").eq("id", guest_pass_id).eq("user_id", user_id).limit(1).execute()
    )

    if verification_response.data:
        raise HTTPException(status_code=409, detail="No se ha podido eliminar el pase de invitado")

    return {"id": guest_pass_id, "deleted": True}


def validate_guest_pass_qr_and_check_in(
    supabase_admin: Client,
    current_user_id: str,
    active_association_id: str,
    qr_token: str,
) -> dict | None:
    guest_pass_response = (
        supabase_admin.table(GUEST_PASS_TABLE)
        .select("id, qr_token, status_id, valid_for_date, space_id")
        .eq("qr_token", qr_token)
        .limit(1)
        .execute()
    )

    if not guest_pass_response.data:
        return None

    guest_pass = guest_pass_response.data[0]
    common_space = _get_common_space(supabase_admin, guest_pass["space_id"])
    association_id = common_space.get("association_id")
    if not association_id:
        raise HTTPException(status_code=400, detail="El pase no esta vinculado a una zona comun valida")

    if str(association_id) != active_association_id:
        raise HTTPException(status_code=403, detail="Este codigo QR no pertenece a la comunidad seleccionada")

    _verify_employee_membership(supabase_admin, str(association_id), current_user_id)

    if int(guest_pass.get("status_id", 0)) != PENDING_STATUS_ID:
        raise HTTPException(status_code=400, detail="Este codigo QR ya ha sido utilizado o ya no es valido")

    today = datetime.now(timezone.utc).date()
    valid_for_date = date.fromisoformat(str(guest_pass["valid_for_date"]))
    if valid_for_date != today:
        raise HTTPException(status_code=400, detail="Este codigo QR no es valido para el dia de hoy")

    update_response = (
        supabase_admin.table(GUEST_PASS_TABLE)
        .update(
            {
                "status_id": CHECKED_IN_STATUS_ID,
                "checked_in_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        .eq("id", guest_pass["id"])
        .eq("status_id", PENDING_STATUS_ID)
        .execute()
    )

    if not update_response.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El estado del pase cambio antes de completar la validacion",
        )

    return {
        "guests_count": 1,
        "status": "checked_in",
        "space_name": common_space.get("name", "N/A"),
        "type": "guest_pass",
    }
