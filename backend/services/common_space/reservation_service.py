from datetime import datetime, timezone

from fastapi import HTTPException, status
from schemas.common_space import QRValidateRequest, ReservationCreate
from supabase import Client

COMMON_SPACE_TABLE = "common_space"
RESERVATION_TABLE = "reservation"
PENDING_STATUS_ID = 1
CHECKED_IN_STATUS_ID = 2
EMPLOYEE_ROLE_ID = "5"


def _get_common_space(supabase: Client, space_id: int) -> dict:
    response = (
        supabase.table(COMMON_SPACE_TABLE)
        .select("id, association_id, max_capacity, max_guests_per_reservation, requires_qr")
        .eq("id", space_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="Common space not found")

    return response.data[0]


def _ensure_guest_limit(space: dict, guests_count: int) -> None:
    max_guests = space.get("max_guests_per_reservation")
    if max_guests is not None and guests_count > int(max_guests):
        raise HTTPException(
            status_code=400,
            detail="Guests count exceeds the maximum allowed for this reservation",
        )


def _has_basic_overlap(supabase: Client, space_id: int, start_at: datetime, end_at: datetime) -> bool:
    overlap_response = (
        supabase.table(RESERVATION_TABLE)
        .select("id")
        .eq("space_id", space_id)
        .neq("status_id", 3)
        .lt("start_at", end_at.isoformat())
        .gt("end_at", start_at.isoformat())
        .limit(1)
        .execute()
    )
    return bool(overlap_response.data)


def create_reservation(supabase: Client, user_id: str, payload: ReservationCreate) -> dict:
    space = _get_common_space(supabase, payload.space_id)
    _ensure_guest_limit(space, payload.guests_count)

    max_capacity = space.get("max_capacity")
    if max_capacity is None or int(max_capacity) <= 1:
        if _has_basic_overlap(supabase, payload.space_id, payload.start_at, payload.end_at):
            raise HTTPException(status_code=400, detail="The selected time slot is no longer available")

    insert_data = {
        "user_id": user_id,
        "space_id": payload.space_id,
        "start_at": payload.start_at.isoformat(),
        "end_at": payload.end_at.isoformat(),
        "guests_count": payload.guests_count,
    }

    response = supabase.table(RESERVATION_TABLE).insert(insert_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="Failed to create reservation")

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
        raise HTTPException(status_code=403, detail="Access denied to this community")

    if str(membership_response.data[0].get("role")) != EMPLOYEE_ROLE_ID:
        raise HTTPException(status_code=403, detail="Employee access required for QR validation")


def validate_qr_and_check_in(
    supabase_admin: Client,
    current_user_id: str,
    payload: QRValidateRequest,
) -> dict:
    reservation_response = (
        supabase_admin.table(RESERVATION_TABLE)
        .select("id, qr_token, status_id, start_at, end_at, guests_count, space_id")
        .eq("qr_token", str(payload.qr_token))
        .limit(1)
        .execute()
    )

    if not reservation_response.data:
        raise HTTPException(status_code=400, detail="Invalid QR token")

    reservation = reservation_response.data[0]
    common_space = _get_common_space(supabase_admin, reservation["space_id"])
    association_id = common_space.get("association_id")
    if not association_id:
        raise HTTPException(status_code=400, detail="Reservation is not linked to a valid common space")

    _verify_employee_membership(supabase_admin, str(association_id), current_user_id)

    if int(reservation.get("status_id", 0)) != PENDING_STATUS_ID:
        raise HTTPException(status_code=400, detail="This QR has already been used or is no longer valid")

    now_utc = datetime.now(timezone.utc).date()
    start_at = datetime.fromisoformat(reservation["start_at"].replace("Z", "+00:00"))
    end_at = datetime.fromisoformat(reservation["end_at"].replace("Z", "+00:00"))
    if not (start_at.date() <= now_utc <= end_at.date()):
        raise HTTPException(status_code=400, detail="This QR is not valid for today")

    update_response = (
        supabase_admin.table(RESERVATION_TABLE)
        .update({"status_id": CHECKED_IN_STATUS_ID})
        .eq("id", reservation["id"])
        .eq("status_id", PENDING_STATUS_ID)
        .execute()
    )

    if not update_response.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Reservation status changed before validation could complete",
        )

    return {
        "guests_count": reservation["guests_count"],
        "status": "checked_in",
    }
