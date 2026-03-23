import io
import os
import sys
import types
from datetime import date, datetime, timedelta, timezone
from importlib import metadata
from typing import Any, Dict, List
from uuid import uuid4

import pydantic.networks
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

os.environ["SUPABASE_URL"] = "http://localhost:8000"
os.environ["SUPABASE_KEY"] = "dummy"
os.environ["SUPABASE_SERVICE_KEY"] = "dummy-service"

email_validator_stub = types.ModuleType("email_validator")


class EmailNotValidError(ValueError):
    pass


def validate_email(email, *args, **kwargs):
    return types.SimpleNamespace(email=email, normalized=email)


email_validator_stub.EmailNotValidError = EmailNotValidError
email_validator_stub.validate_email = validate_email
sys.modules["email_validator"] = email_validator_stub

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
import api.common_space.common_space as common_space_api  # noqa: E402
from core.deps import get_current_user, get_supabase, get_supabase_admin  # noqa: E402

app = FastAPI()
app.include_router(common_space_router)
app.include_router(guest_passes_router)
app.include_router(reservations_router)
client = TestClient(app)

ASSOCIATION_ID = "11111111-1111-1111-1111-111111111111"
USER_ID = "11111111-1111-1111-1111-111111111110"
EMPLOYEE_ID = "11111111-1111-1111-1111-111111111115"


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

        return MockResponse([dict(row) for row in self._filtered_rows()])


class MockSupabaseReservationClient:
    def __init__(self):
        now = datetime.now(timezone.utc)
        today = now.date().isoformat()
        self.storage = {
            "common_space": [
                {
                    "id": 1,
                    "association_id": ASSOCIATION_ID,
                    "name": "Piscina",
                    "requires_qr": True,
                    "max_capacity": None,
                    "max_guests_per_reservation": 2,
                    "photo_url": None,
                    "usage_mode": "guest_pass",
                },
                {
                    "id": 2,
                    "association_id": ASSOCIATION_ID,
                    "name": "Pista de padel",
                    "requires_qr": True,
                    "max_capacity": 1,
                    "max_guests_per_reservation": 3,
                    "photo_url": None,
                    "usage_mode": "exclusive_reservation",
                },
                {
                    "id": 3,
                    "association_id": ASSOCIATION_ID,
                    "name": "Sala multiusos",
                    "requires_qr": True,
                    "max_capacity": 10,
                    "max_guests_per_reservation": 6,
                    "photo_url": None,
                    "usage_mode": "exclusive_reservation",
                },
            ],
            "reservation": [
                {
                    "id": 1,
                    "user_id": USER_ID,
                    "space_id": 2,
                    "start_at": (now + timedelta(hours=4)).isoformat(),
                    "end_at": (now + timedelta(hours=5)).isoformat(),
                    "qr_token": str(uuid4()),
                    "status_id": 1,
                    "guests_count": 0,
                },
                {
                    "id": 2,
                    "user_id": USER_ID,
                    "space_id": 2,
                    "start_at": (now + timedelta(hours=6)).isoformat(),
                    "end_at": (now + timedelta(hours=7)).isoformat(),
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

    monkeypatch.setattr(
        common_space_api,
        "upload_common_space_photo_service",
        lambda file_bytes, filename, content_type: {"secure_url": f"https://cdn.test/{filename}"},
    )

    yield state

    app.dependency_overrides.clear()


def test_upload_common_space_photo(setup_overrides):
    response = client.post(
        "/common-spaces/upload-photo",
        files={"file": ("photo.png", io.BytesIO(b"fake-image"), "image/png")},
    )

    assert response.status_code == 200
    assert response.json()["secure_url"] == "https://cdn.test/photo.png"


def test_create_common_space_with_body_association_id(setup_overrides):
    response = client.post(
        "/common-spaces/",
        json={
            "association_id": ASSOCIATION_ID,
            "name": "Azotea",
            "requires_qr": False,
            "max_capacity": 20,
            "max_guests_per_reservation": 4,
            "photo_url": "https://cdn.test/azotea.png",
            "usage_mode": "exclusive_reservation",
        },
    )

    assert response.status_code == 201
    assert response.json()["association_id"] == ASSOCIATION_ID
    assert response.json()["name"] == "Azotea"
    assert response.json()["usage_mode"] == "exclusive_reservation"


def test_create_reservation_returns_qr_token(setup_overrides):
    now = datetime.now(timezone.utc)
    response = client.post(
        "/reservations/",
        json={
            "space_id": 3,
            "start_at": (now + timedelta(hours=3)).isoformat(),
            "end_at": (now + timedelta(hours=4)).isoformat(),
            "guests_count": 4,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["space_id"] == 3
    assert data["status_id"] == 1
    assert data["qr_token"]


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
    assert response.json()["detail"] == "Esta zona común no admite reservas por franja horaria"


def test_create_reservation_rejects_overlap_when_capacity_is_one(setup_overrides):
    now = datetime.now(timezone.utc)
    response = client.post(
        "/reservations/",
        json={
            "space_id": 2,
            "start_at": (now + timedelta(hours=4, minutes=30)).isoformat(),
            "end_at": (now + timedelta(hours=5, minutes=30)).isoformat(),
            "guests_count": 1,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "La franja horaria seleccionada ya no está disponible"


def test_create_reservation_rejects_when_daily_limit_is_reached(setup_overrides):
    now = datetime.now(timezone.utc)
    client_state = setup_overrides["client"]
    client_state.storage["reservation"].append(
        {
            "id": 4,
            "user_id": USER_ID,
            "space_id": 2,
            "start_at": (now + timedelta(hours=8)).isoformat(),
            "end_at": (now + timedelta(hours=9)).isoformat(),
            "qr_token": str(uuid4()),
            "status_id": 1,
            "guests_count": 0,
        }
    )

    response = client.post(
        "/reservations/",
        json={
            "space_id": 2,
            "start_at": (now + timedelta(hours=10)).isoformat(),
            "end_at": (now + timedelta(hours=11)).isoformat(),
            "guests_count": 0,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Has alcanzado el límite diario de reservas para esta zona común"


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


def test_create_guest_pass_rejects_exclusive_spaces(setup_overrides):
    response = client.post(
        "/guest-passes/",
        json={
            "space_id": 2,
            "valid_for_date": date.today().isoformat(),
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Esta zona común no admite pases de invitado"


def test_validate_qr_checks_in_pending_reservation_for_today(setup_overrides):
    reservation = setup_overrides["client"].storage["reservation"][0]
    app.dependency_overrides[get_current_user] = lambda: setup_overrides["admin_user"]

    response = client.post(
        "/reservations/validate-qr",
        json={"qr_token": reservation["qr_token"]},
    )

    assert response.status_code == 200
    assert response.json() == {"guests_count": 0, "status": "checked_in"}
    assert reservation["status_id"] == 2


def test_validate_qr_checks_in_pending_guest_pass_for_today(setup_overrides):
    guest_pass = setup_overrides["client"].storage["guest_pass"][0]
    app.dependency_overrides[get_current_user] = lambda: setup_overrides["admin_user"]

    response = client.post(
        "/reservations/validate-qr",
        json={"qr_token": guest_pass["qr_token"]},
    )

    assert response.status_code == 200
    assert response.json() == {"guests_count": 1, "status": "checked_in"}
    assert guest_pass["status_id"] == 2


def test_validate_qr_rejects_used_code(setup_overrides):
    reservation = setup_overrides["client"].storage["reservation"][0]
    reservation["status_id"] = 2
    app.dependency_overrides[get_current_user] = lambda: setup_overrides["admin_user"]

    response = client.post(
        "/reservations/validate-qr",
        json={"qr_token": reservation["qr_token"]},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Este código QR ya ha sido utilizado o ya no es válido"
