import os
import sys
import types
from datetime import date, datetime, timedelta, timezone
from importlib import metadata
from typing import Any, Dict, List
from uuid import uuid4
from zoneinfo import ZoneInfo

import pydantic.networks
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

os.environ["SUPABASE_URL"] = "http://localhost:8000"
os.environ["SUPABASE_KEY"] = "dummy"
os.environ["SUPABASE_SERVICE_KEY"] = "dummy-service"

# email_validator stub removed
resend_stub = types.ModuleType("resend")
resend_stub.api_key = None


class _Emails:
    @staticmethod
    def send(*args, **kwargs):
        return None


resend_stub.Emails = _Emails
sys.modules["resend"] = resend_stub

original_version = metadata.version


def patched_version(distribution_name: str) -> str:
    if distribution_name == "email-validator":
        return "2.0.0"
    return original_version(distribution_name)


metadata.version = patched_version
pydantic.networks.version = patched_version

from api.common_space.common_space import router as common_space_router  # noqa: E402
from api.common_space.guest_passes import router as guest_passes_router  # noqa: E402
from api.common_space.reservations import router as reservations_router  # noqa: E402
from core.deps import get_current_user, get_supabase, get_supabase_admin  # noqa: E402

app = FastAPI()
app.include_router(common_space_router)
app.include_router(guest_passes_router)
app.include_router(reservations_router)
client = TestClient(app)

ASSOCIATION_ID = "11111111-1111-1111-1111-111111111111"
USER_ID = "11111111-1111-1111-1111-111111111110"
EMPLOYEE_ID = "11111111-1111-1111-1111-111111111115"
MADRID_TZ = ZoneInfo("Europe/Madrid")


class MockResponse:
    def __init__(self, data):
        self.data = data


class MockSupabaseTable:
    def __init__(self, table_name: str, storage: Dict[str, List[Dict[str, Any]]]):
        self._table_name = table_name
        self._storage = storage
        self._operation = "select"
        self._payload = None
        self._filters = []
        self._limit = None

    def select(self, *args, **kwargs):
        if self._operation not in {"insert", "update"}:
            self._operation = "select"
        return self

    def eq(self, column, value, **kwargs):
        self._filters.append(("eq", column, value))
        return self

    def neq(self, column, value, **kwargs):
        self._filters.append(("neq", column, value))
        return self

    def lt(self, column, value, **kwargs):
        self._filters.append(("lt", column, value))
        return self

    def gt(self, column, value, **kwargs):
        self._filters.append(("gt", column, value))
        return self

    def limit(self, value, *args, **kwargs):
        self._limit = value
        return self

    def insert(self, payload, *args, **kwargs):
        self._operation = "insert"
        self._payload = payload
        return self

    def delete(self, *args, **kwargs):
        self._operation = "delete"
        return self

    def update(self, payload, *args, **kwargs):
        self._operation = "update"
        self._payload = payload
        return self

    def _coerce(self, value):
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value.replace("Z", "+00:00"))
            except ValueError:
                try:
                    return date.fromisoformat(value)
                except ValueError:
                    return value
        return value

    def _matches(self, row: Dict[str, Any]) -> bool:
        for operator, column, value in self._filters:
            row_value = self._coerce(row.get(column))
            target_value = self._coerce(value)

            if operator == "eq" and row_value != target_value:
                return False
            if operator == "neq" and row_value == target_value:
                return False
            if operator == "lt" and not (row_value < target_value):
                return False
            if operator == "gt" and not (row_value > target_value):
                return False
        return True

    def _filtered_rows(self):
        rows = [row for row in self._storage[self._table_name] if self._matches(row)]
        if self._limit is not None:
            rows = rows[: self._limit]
        return rows

    def execute(self):
        if self._operation == "insert":
            current = self._storage[self._table_name]
            next_id = max((row["id"] for row in current), default=0) + 1
            new_row = dict(self._payload)
            new_row["id"] = next_id
            if self._table_name == "reservation":
                new_row["status_id"] = 1
                new_row["qr_token"] = str(uuid4())
            if self._table_name == "guest_pass":
                new_row["status_id"] = 1
                new_row["qr_token"] = str(uuid4())
                new_row["checked_in_at"] = None
                new_row["created_at"] = datetime.now(timezone.utc).isoformat()
            if self._table_name == "common_space":
                new_row["created_at"] = datetime.now(timezone.utc).isoformat()
            current.append(new_row)
            return MockResponse([new_row])

        if self._operation == "update":
            updated = []
            for row in self._storage[self._table_name]:
                if self._matches(row):
                    row.update(self._payload)
                    updated.append(dict(row))
            return MockResponse(updated)

        if self._operation == "delete":
            remaining = []
            deleted = []
            for row in self._storage[self._table_name]:
                if self._matches(row):
                    deleted.append(dict(row))
                else:
                    remaining.append(row)
            self._storage[self._table_name] = remaining
            return MockResponse(deleted)

        return MockResponse([dict(row) for row in self._filtered_rows()])


class MockSupabaseReservationClient:
    def __init__(self):
        now = datetime.now(timezone.utc)
        today = now.date().isoformat()
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        self.storage = {
            "common_space": [
                {
                    "id": 1,
                    "association_id": ASSOCIATION_ID,
                    "name": "Piscina",
                    "requires_qr": True,
                    "capacity": None,
                    "max_guests_per_reservation": 2,
                    "start_time": "09:00:00",
                    "end_time": "23:00:00",
                    "usage_mode": "guest_pass",
                },
                {
                    "id": 2,
                    "association_id": ASSOCIATION_ID,
                    "name": "Pista de padel",
                    "requires_qr": True,
                    "capacity": 1,
                    "max_guests_per_reservation": 3,
                    "start_time": "09:00:00",
                    "end_time": "23:00:00",
                    "usage_mode": "exclusive_reservation",
                },
                {
                    "id": 3,
                    "association_id": ASSOCIATION_ID,
                    "name": "Sala multiusos",
                    "requires_qr": False,
                    "capacity": 10,
                    "max_guests_per_reservation": 6,
                    "start_time": "09:00:00",
                    "end_time": "23:00:00",
                    "usage_mode": "exclusive_reservation",
                },
            ],
            "reservation": [
                {
                    "id": 1,
                    "user_id": USER_ID,
                    "space_id": 2,
                    "start_at": (day_start + timedelta(hours=10)).isoformat(),
                    "end_at": (day_start + timedelta(hours=11)).isoformat(),
                    "qr_token": str(uuid4()),
                    "status_id": 1,
                    "guests_count": 0,
                },
                {
                    "id": 2,
                    "user_id": USER_ID,
                    "space_id": 2,
                    "start_at": (day_start + timedelta(hours=12)).isoformat(),
                    "end_at": (day_start + timedelta(hours=13)).isoformat(),
                    "qr_token": str(uuid4()),
                    "status_id": 2,
                    "guests_count": 0,
                },
            ],
            "guest_pass": [
                {
                    "id": 1,
                    "user_id": USER_ID,
                    "space_id": 1,
                    "valid_for_date": today,
                    "qr_token": str(uuid4()),
                    "status_id": 1,
                    "checked_in_at": None,
                    "created_at": now.isoformat(),
                }
            ],
            "memberships": [
                {
                    "association_id": ASSOCIATION_ID,
                    "profile_id": USER_ID,
                    "role": 1,
                },
                {
                    "association_id": ASSOCIATION_ID,
                    "profile_id": EMPLOYEE_ID,
                    "role": 5,
                },
            ],
        }

    def table(self, name: str):
        if name not in {"common_space", "reservation", "guest_pass", "memberships"}:
            raise AssertionError(f"Unexpected table requested: {name}")
        return MockSupabaseTable(name, self.storage)


@pytest.fixture(autouse=True)
def setup_overrides(monkeypatch):
    state = {
        "user": {
            "id": USER_ID,
            "role": "authenticated",
            "email": "user@test.com",
        },
        "admin_user": {
            "id": EMPLOYEE_ID,
            "role": "authenticated",
            "email": "employee@test.com",
        },
        "client": MockSupabaseReservationClient(),
    }

    app.dependency_overrides[get_current_user] = lambda: state["user"]
    app.dependency_overrides[get_supabase] = lambda: state["client"]
    app.dependency_overrides[get_supabase_admin] = lambda: state["client"]

    yield state

    app.dependency_overrides.clear()


def test_create_common_space_with_association_in_path(setup_overrides):
    response = client.post(
        f"/common-spaces/{ASSOCIATION_ID}",
        json={
            "name": "Azotea",
            "requires_qr": False,
            "max_capacity": 20,
            "max_guests_per_reservation": 4,
            "usage_mode": "exclusive_reservation",
        },
    )

    assert response.status_code == 201
    assert response.json()["association_id"] == ASSOCIATION_ID
    assert response.json()["name"] == "Azotea"
    assert response.json()["usage_mode"] == "exclusive_reservation"


# Modifica estos tests en backend/tests/common_space/test_reservations.py


def test_create_reservation_returns_qr_token(setup_overrides):
    # Usamos una fecha futura con hora fija (10:00 UTC = 12:00 Madrid) para garantizar
    # que siempre caiga dentro del horario de apertura (09:00-23:00) sin depender de la hora actual
    future_date = (datetime.now(timezone.utc) + timedelta(days=2)).replace(hour=10, minute=0, second=0, microsecond=0)
    response = client.post(
        "/reservations/",
        json={
            "space_id": 3,
            "start_at": future_date.isoformat(),
            "end_at": (future_date + timedelta(hours=1)).isoformat(),
            "guests_count": 1,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["space_id"] == 3
    assert data["qr_token"]


def test_create_reservation_rejects_overlap_for_multiuse_room_too(setup_overrides):
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    setup_overrides["client"].storage["reservation"].append(
        {
            "id": 5,
            "user_id": USER_ID,
            "space_id": 3,
            "start_at": (day_start + timedelta(hours=17)).isoformat(),
            "end_at": (day_start + timedelta(hours=18)).isoformat(),
            "qr_token": str(uuid4()),
            "status_id": 1,
            "guests_count": 2,
        }
    )

    response = client.post(
        "/reservations/",
        json={
            "space_id": 3,
            "start_at": (day_start + timedelta(hours=17)).isoformat(),
            "end_at": (day_start + timedelta(hours=18)).isoformat(),
            "guests_count": 1,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "La franja horaria seleccionada ya no esta disponible"


def test_create_reservation_rejects_slot_before_opening_time(setup_overrides):
    local_start = datetime.now(MADRID_TZ).replace(hour=8, minute=0, second=0, microsecond=0)
    local_end = local_start + timedelta(hours=1)

    response = client.post(
        "/reservations/",
        json={
            "space_id": 3,
            "start_at": local_start.astimezone(timezone.utc).isoformat(),
            "end_at": local_end.astimezone(timezone.utc).isoformat(),
            "guests_count": 1,
        },
    )

    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == "La reserva debe estar comprendida entre la hora de apertura y la de cierre de la zona comun"
    )


def test_create_reservation_rejects_slot_ending_after_closing_time(setup_overrides):
    local_start = datetime.now(MADRID_TZ).replace(hour=22, minute=0, second=0, microsecond=0)
    local_end = local_start + timedelta(hours=1, minutes=30)

    response = client.post(
        "/reservations/",
        json={
            "space_id": 3,
            "start_at": local_start.astimezone(timezone.utc).isoformat(),
            "end_at": local_end.astimezone(timezone.utc).isoformat(),
            "guests_count": 1,
        },
    )

    assert response.status_code == 400
    assert (
        response.json()["detail"]
        == "La reserva debe estar comprendida entre la hora de apertura y la de cierre de la zona comun"
    )


def test_create_reservation_allows_slot_starting_exactly_at_opening_time(setup_overrides):
    local_start = datetime.now(MADRID_TZ).replace(hour=9, minute=0, second=0, microsecond=0)
    local_end = local_start + timedelta(hours=1)

    response = client.post(
        "/reservations/",
        json={
            "space_id": 3,
            "start_at": local_start.astimezone(timezone.utc).isoformat(),
            "end_at": local_end.astimezone(timezone.utc).isoformat(),
            "guests_count": 1,
        },
    )

    assert response.status_code == 201


def test_create_reservation_rejects_guest_pass_spaces(setup_overrides):
    now = datetime.now(timezone.utc)
    response = client.post(
        "/reservations/",
        json={
            "space_id": 1,
            "start_at": (now + timedelta(hours=1)).isoformat(),
            "end_at": (now + timedelta(hours=2)).isoformat(),
            "guests_count": 1,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Esta zona comun no admite reservas por franja horaria"


def test_create_reservation_rejects_overlap_when_capacity_is_one(setup_overrides):
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    response = client.post(
        "/reservations/",
        json={
            "space_id": 2,
            "start_at": (day_start + timedelta(hours=10, minutes=30)).isoformat(),
            "end_at": (day_start + timedelta(hours=11, minutes=30)).isoformat(),
            "guests_count": 1,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "La franja horaria seleccionada ya no esta disponible"


def test_create_reservation_rejects_when_daily_limit_is_reached(setup_overrides):
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    client_state = setup_overrides["client"]
    client_state.storage["reservation"].append(
        {
            "id": 4,
            "user_id": USER_ID,
            "space_id": 2,
            "start_at": (day_start + timedelta(hours=14)).isoformat(),
            "end_at": (day_start + timedelta(hours=15)).isoformat(),
            "qr_token": str(uuid4()),
            "status_id": 1,
            "guests_count": 0,
        }
    )

    response = client.post(
        "/reservations/",
        json={
            "space_id": 2,
            "start_at": (day_start + timedelta(hours=16)).isoformat(),
            "end_at": (day_start + timedelta(hours=17)).isoformat(),
            "guests_count": 0,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Has alcanzado el limite diario de reservas para esta zona comun"


def test_create_guest_pass_returns_qr_token(setup_overrides):
    response = client.post(
        "/guest-passes/",
        json={
            "space_id": 1,
            "valid_for_date": date.today().isoformat(),
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["space_id"] == 1
    assert data["status_id"] == 1
    assert data["qr_token"]


def test_create_guest_pass_rejects_user_outside_association(setup_overrides):
    app.dependency_overrides[get_current_user] = lambda: {
        "id": str(uuid4()),
        "role": "authenticated",
        "email": "outsider@test.com",
    }

    response = client.post(
        "/guest-passes/",
        json={
            "space_id": 1,
            "valid_for_date": date.today().isoformat(),
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "No tienes acceso a esta comunidad"


def test_create_guest_pass_allows_first_pass_when_capacity_is_one(setup_overrides):
    setup_overrides["client"].storage["common_space"].append(
        {
            "id": 4,
            "association_id": ASSOCIATION_ID,
            "name": "Solarium",
            "requires_qr": True,
            "capacity": 1,
            "max_guests_per_reservation": 3,
            "start_time": "09:00:00",
            "end_time": "23:00:00",
            "usage_mode": "guest_pass",
        }
    )

    payload = {
        "space_id": 4,
        "valid_for_date": date.today().isoformat(),
    }
    first_response = client.post("/guest-passes/", json=payload)
    second_response = client.post("/guest-passes/", json=payload)

    assert first_response.status_code == 201
    assert second_response.status_code == 400
    assert "capacidad" in second_response.json()["detail"]


def test_list_occupied_slots_returns_active_slots_for_day(setup_overrides):
    now = datetime.now(timezone.utc)
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    setup_overrides["client"].storage["reservation"].append(
        {
            "id": 6,
            "user_id": USER_ID,
            "space_id": 3,
            "start_at": (day_start + timedelta(hours=17)).isoformat(),
            "end_at": (day_start + timedelta(hours=18)).isoformat(),
            "qr_token": str(uuid4()),
            "status_id": 1,
            "guests_count": 0,
        }
    )

    response = client.get(f"/reservations/occupied-slots?space_id=3&reservation_date={now.date().isoformat()}")

    assert response.status_code == 200
    assert len(response.json()) == 1


def test_list_my_reservations_filters_by_association(setup_overrides):
    response = client.get(f"/reservations/me?association_id={ASSOCIATION_ID}")

    assert response.status_code == 200
    assert len(response.json()) >= 2
    assert response.json()[0]["association_id"] == ASSOCIATION_ID


def test_cancel_reservation_updates_status(setup_overrides):
    future_day_start = (datetime.now(timezone.utc) + timedelta(days=2)).replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )
    response = client.post(
        "/reservations/",
        json={
            "space_id": 3,
            "start_at": (future_day_start + timedelta(hours=14)).isoformat(),
            "end_at": (future_day_start + timedelta(hours=15)).isoformat(),
            "guests_count": 0,
        },
    )
    assert response.status_code == 201, response.json()
    reservation_id = response.json()["id"]

    cancel_response = client.patch(f"/reservations/{reservation_id}/cancel")

    assert cancel_response.status_code == 200
    assert cancel_response.json()["deleted"] is True


def test_create_guest_pass_rejects_exclusive_spaces(setup_overrides):
    response = client.post(
        "/guest-passes/",
        json={
            "space_id": 2,
            "valid_for_date": date.today().isoformat(),
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Esta zona comun no admite pases de invitado"


def test_list_my_guest_passes_returns_current_user_passes(setup_overrides):
    response = client.get(f"/guest-passes/me?association_id={ASSOCIATION_ID}")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["association_id"] == ASSOCIATION_ID


def test_cancel_guest_pass_updates_status(setup_overrides):
    guest_pass = setup_overrides["client"].storage["guest_pass"][0]

    response = client.patch(f"/guest-passes/{guest_pass['id']}/cancel")

    assert response.status_code == 200
    assert response.json()["deleted"] is True


def test_validate_qr_checks_in_pending_reservation_for_today(setup_overrides):
    reservation = setup_overrides["client"].storage["reservation"][0]
    app.dependency_overrides[get_current_user] = lambda: setup_overrides["admin_user"]

    response = client.post(
        "/reservations/validate-qr",
        json={
            "qr_token": reservation["qr_token"],
            "association_id": ASSOCIATION_ID,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["guests_count"] == 0
    assert data["status"] == "checked_in"
    assert data["space_name"] == "Pista de padel"
    assert data["type"] == "reservation"
    assert reservation["status_id"] == 2


def test_validate_qr_checks_in_pending_guest_pass_for_today(setup_overrides):
    guest_pass = setup_overrides["client"].storage["guest_pass"][0]
    app.dependency_overrides[get_current_user] = lambda: setup_overrides["admin_user"]

    response = client.post(
        "/reservations/validate-qr",
        json={
            "qr_token": guest_pass["qr_token"],
            "association_id": ASSOCIATION_ID,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["guests_count"] == 1
    assert data["status"] == "checked_in"
    assert data["space_name"] == "Piscina"
    assert data["type"] == "guest_pass"
    assert guest_pass["status_id"] == 2


def test_validate_qr_rejects_used_code(setup_overrides):
    reservation = setup_overrides["client"].storage["reservation"][0]
    reservation["status_id"] = 2
    app.dependency_overrides[get_current_user] = lambda: setup_overrides["admin_user"]

    response = client.post(
        "/reservations/validate-qr",
        json={
            "qr_token": reservation["qr_token"],
            "association_id": ASSOCIATION_ID,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Este codigo QR ya ha sido utilizado o ya no es valido"


def test_validate_qr_rejects_code_from_another_selected_community(setup_overrides):
    reservation = setup_overrides["client"].storage["reservation"][0]
    app.dependency_overrides[get_current_user] = lambda: setup_overrides["admin_user"]

    response = client.post(
        "/reservations/validate-qr",
        json={
            "qr_token": reservation["qr_token"],
            "association_id": "22222222-2222-2222-2222-222222222222",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Este codigo QR no pertenece a la comunidad seleccionada"
