from datetime import datetime, timezone

from fastapi import HTTPException, status
from schemas.common_space import QRValidateRequest, ReservationCreate
from supabase import Client

COMMON_SPACE_TABLE = "common_space"
RESERVATION_TABLE = "reservation"
PENDING_STATUS_ID = 1
CHECKED_IN_STATUS_ID = 2
EMPLOYEE_ROLE_ID = "5"
ACTIVE_STATUS_IDS = {PENDING_STATUS_ID, CHECKED_IN_STATUS_ID}
MAX_RESERVATIONS_PER_DAY = 3
EXCLUSIVE_RESERVATION_MODE = "exclusive_reservation"


def _get_common_space(supabase: Client, space_id: int) -> dict:
    response = (
        supabase.table(COMMON_SPACE_TABLE)
        .select("id, association_id, max_capacity, max_guests_per_reservation, requires_qr, usage_mode")
        .eq("id", space_id)
        .limit(1)
        .execute()
    )

    if not response.data:
        raise HTTPException(status_code=404, detail="No se ha encontrado la zona común")

    return response.data[0]


def _ensure_guest_limit(space: dict, guests_count: int) -> None:
    max_guests = space.get("max_guests_per_reservation")
    if max_guests is not None and guests_count > int(max_guests):
        raise HTTPException(
            status_code=400,
            detail="El número de invitados supera el máximo permitido para esta reserva",
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


def _count_user_daily_reservations(supabase: Client, user_id: str, space_id: int, reservation_date) -> int:
    reservations_response = (
        supabase.table(RESERVATION_TABLE)
        .select("id, status_id, start_at")
        .eq("user_id", user_id)
        .eq("space_id", space_id)
        .neq("status_id", 3)
        .execute()
    )

    count = 0
    for reservation in reservations_response.data or []:
        status_id = int(reservation.get("status_id", 0))
        if status_id not in ACTIVE_STATUS_IDS:
            continue

        start_at = datetime.fromisoformat(str(reservation["start_at"]).replace("Z", "+00:00"))
        if start_at.date() == reservation_date:
            count += 1

    return count


def create_reservation(supabase: Client, user_id: str, payload: ReservationCreate) -> dict:
    space = _get_common_space(supabase, payload.space_id)
    if space.get("usage_mode") != EXCLUSIVE_RESERVATION_MODE:
        raise HTTPException(
            status_code=400,
            detail="Esta zona común no admite reservas por franja horaria",
        )

    _ensure_guest_limit(space, payload.guests_count)

    reservation_date = payload.start_at.date()
    user_daily_reservations = _count_user_daily_reservations(supabase, user_id, payload.space_id, reservation_date)
    if user_daily_reservations >= MAX_RESERVATIONS_PER_DAY:
        raise HTTPException(
            status_code=400,
            detail="Has alcanzado el límite diario de reservas para esta zona común",
        )

    max_capacity = space.get("max_capacity")
    if max_capacity is not None and int(max_capacity) <= 1:
        if _has_basic_overlap(supabase, payload.space_id, payload.start_at, payload.end_at):
            raise HTTPException(status_code=400, detail="La franja horaria seleccionada ya no está disponible")

    insert_data = {
        "user_id": user_id,
        "space_id": payload.space_id,
        "start_at": payload.start_at.isoformat(),
        "end_at": payload.end_at.isoformat(),
        "guests_count": payload.guests_count,
    }

    response = supabase.table(RESERVATION_TABLE).insert(insert_data).execute()

    if not response.data:
        raise HTTPException(status_code=500, detail="No se ha podido crear la reserva")

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


def validate_reservation_qr_and_check_in(
    supabase_admin: Client,
    current_user_id: str,
    qr_token: str,
) -> dict | None:
    reservation_response = (
        supabase_admin.table(RESERVATION_TABLE)
        .select("id, qr_token, status_id, start_at, end_at, guests_count, space_id")
        .eq("qr_token", qr_token)
        .limit(1)
        .execute()
    )

    if not reservation_response.data:
        return None

    reservation = reservation_response.data[0]
    common_space = _get_common_space(supabase_admin, reservation["space_id"])
    association_id = common_space.get("association_id")
    if not association_id:
        raise HTTPException(status_code=400, detail="La reserva no está vinculada a una zona común válida")

    _verify_employee_membership(supabase_admin, str(association_id), current_user_id)

    if int(reservation.get("status_id", 0)) != PENDING_STATUS_ID:
        raise HTTPException(status_code=400, detail="Este código QR ya ha sido utilizado o ya no es válido")

    now_utc = datetime.now(timezone.utc).date()
    start_at = datetime.fromisoformat(reservation["start_at"].replace("Z", "+00:00"))
    end_at = datetime.fromisoformat(reservation["end_at"].replace("Z", "+00:00"))
    if not (start_at.date() <= now_utc <= end_at.date()):
        raise HTTPException(status_code=400, detail="Este código QR no es válido para el día de hoy")

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
            detail="El estado de la reserva cambió antes de completar la validación",
        )

    return {
        "guests_count": reservation["guests_count"],
        "status": "checked_in",
    }


def validate_qr_and_check_in(
    supabase_admin: Client,
    current_user_id: str,
    payload: QRValidateRequest,
) -> dict:
    from services.common_space.guest_pass_service import validate_guest_pass_qr_and_check_in

    qr_token = str(payload.qr_token)

    reservation_result = validate_reservation_qr_and_check_in(supabase_admin, current_user_id, qr_token)
    if reservation_result:
        return reservation_result

    guest_pass_result = validate_guest_pass_qr_and_check_in(supabase_admin, current_user_id, qr_token)
    if guest_pass_result:
        return guest_pass_result

    raise HTTPException(status_code=400, detail="El código QR no es válido")
