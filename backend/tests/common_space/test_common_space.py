import os
import sys
import types
from importlib import metadata
from typing import Any, Dict, List

import pytest
import pydantic.networks
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

from api.common_space.common_space import router  # noqa: E402
from core.deps import get_current_user, get_supabase, get_supabase_admin  # noqa: E402

app = FastAPI()
app.include_router(router)
client = TestClient(app)

ASSOCIATION_ID = "11111111-1111-1111-1111-111111111111"
OTHER_ASSOCIATION_ID = "22222222-2222-2222-2222-222222222222"
USER_ID = "user-1"


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

    def order(self, *args, **kwargs):
        return self

    def eq(self, column, value, **kwargs):
        self._filters.append((column, value))
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

    def delete(self, *args, **kwargs):
        self._operation = "delete"
        return self

    def _filtered_rows(self):
        rows = list(self._storage[self._table_name])
        for column, value in self._filters:
            rows = [row for row in rows if row.get(column) == value]
        if self._limit is not None:
            rows = rows[: self._limit]
        return rows

    def execute(self):
        if self._operation == "insert":
            current = self._storage[self._table_name]
            next_id = (max((row["id"] for row in current), default=0) + 1) if self._table_name == "common_space" else None
            new_row = dict(self._payload)
            if self._table_name == "common_space":
                new_row["id"] = next_id
                new_row["created_at"] = "2026-03-18T10:00:00"
            current.append(new_row)
            return MockResponse([new_row])

        if self._operation == "update":
            rows = self._filtered_rows()
            updated = []
            for target in rows:
                for row in self._storage[self._table_name]:
                    if row is target:
                        row.update(self._payload)
                        updated.append(dict(row))
                        break
            return MockResponse(updated)

        if self._operation == "delete":
            rows = self._filtered_rows()
            ids_to_delete = {id(row) for row in rows}
            deleted = [dict(row) for row in rows]
            self._storage[self._table_name] = [
                row for row in self._storage[self._table_name] if id(row) not in ids_to_delete
            ]
            return MockResponse(deleted)

        return MockResponse(self._filtered_rows())


class MockSupabaseClientCommonSpace:
    def __init__(self, user_id: str, role: int = 1, has_membership: bool = True):
        self.storage: Dict[str, List[Dict[str, Any]]] = {
            "common_space": [
                {
                    "id": 1,
                    "association_id": ASSOCIATION_ID,
                    "name": "Piscina",
                    "requires_qr": True,
                    "created_at": "2026-03-15T09:00:00",
                },
                {
                    "id": 2,
                    "association_id": ASSOCIATION_ID,
                    "name": "Gimnasio",
                    "requires_qr": False,
                    "created_at": "2026-03-16T09:00:00",
                },
                {
                    "id": 3,
                    "association_id": OTHER_ASSOCIATION_ID,
                    "name": "Trastero",
                    "requires_qr": False,
                    "created_at": "2026-03-16T10:00:00",
                },
            ],
            "memberships": [],
        }

        if has_membership:
            self.storage["memberships"].append(
                {
                    "association_id": ASSOCIATION_ID,
                    "profile_id": user_id,
                    "role": role,
                }
            )

    def table(self, name: str):
        if name not in {"common_space", "memberships"}:
            raise AssertionError(f"Unexpected table requested: {name}")
        return MockSupabaseTable(name, self.storage)


@pytest.fixture(autouse=True)
def setup_overrides():
    state = {
        "user": {
            "id": USER_ID,
            "role": "authenticated",
            "email": "user@test.com",
        },
        "client": MockSupabaseClientCommonSpace(user_id=USER_ID, role=1, has_membership=True),
    }

    app.dependency_overrides[get_current_user] = lambda: state["user"]
    app.dependency_overrides[get_supabase] = lambda: state["client"]
    app.dependency_overrides[get_supabase_admin] = lambda: state["client"]

    yield state

    app.dependency_overrides.clear()


def test_list_common_spaces_filters_by_association(setup_overrides):
    response = client.get(f"/common-spaces/{ASSOCIATION_ID}")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name"] == "Piscina"
    assert all(item["association_id"] == ASSOCIATION_ID for item in data)


def test_get_common_space_by_id(setup_overrides):
    response = client.get(f"/common-spaces/{ASSOCIATION_ID}/1")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["requires_qr"] is True
    assert data["association_id"] == ASSOCIATION_ID


def test_create_common_space_as_admin(setup_overrides):
    response = client.post(
        f"/common-spaces/{ASSOCIATION_ID}",
        json={
            "name": "Sala comun",
            "requires_qr": True,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["id"] == 4
    assert data["name"] == "Sala comun"
    assert data["requires_qr"] is True
    assert data["association_id"] == ASSOCIATION_ID


def test_create_common_space_as_president(setup_overrides):
    setup_overrides["client"] = MockSupabaseClientCommonSpace(user_id=USER_ID, role=4, has_membership=True)

    response = client.post(
        f"/common-spaces/{ASSOCIATION_ID}",
        json={
            "name": "Pista de padel",
            "requires_qr": False,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Pista de padel"


def test_create_common_space_forbidden_for_regular_member(setup_overrides):
    setup_overrides["client"] = MockSupabaseClientCommonSpace(user_id=USER_ID, role=3, has_membership=True)

    response = client.post(
        f"/common-spaces/{ASSOCIATION_ID}",
        json={
            "name": "Sala social",
            "requires_qr": False,
        },
    )

    assert response.status_code == 403


def test_update_common_space(setup_overrides):
    response = client.put(
        f"/common-spaces/{ASSOCIATION_ID}/2",
        json={
            "name": "Gimnasio renovado",
            "requires_qr": True,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 2
    assert data["name"] == "Gimnasio renovado"
    assert data["requires_qr"] is True


def test_delete_common_space_forbidden_for_regular_member(setup_overrides):
    setup_overrides["client"] = MockSupabaseClientCommonSpace(user_id=USER_ID, role=5, has_membership=True)
    response = client.delete(f"/common-spaces/{ASSOCIATION_ID}/1")

    assert response.status_code == 403


def test_delete_common_space(setup_overrides):
    response = client.delete(f"/common-spaces/{ASSOCIATION_ID}/1")

    assert response.status_code == 204


def test_list_common_spaces_requires_membership(setup_overrides):
    setup_overrides["client"] = MockSupabaseClientCommonSpace(user_id=USER_ID, role=1, has_membership=False)
    response = client.get(f"/common-spaces/{ASSOCIATION_ID}")
    assert response.status_code == 403
