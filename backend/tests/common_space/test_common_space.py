import os
import sys
import types
from importlib import metadata

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

from api.common_space.common_spaces import router  # noqa: E402
from core.deps import get_current_user, get_supabase, get_supabase_admin  # noqa: E402

app = FastAPI()
app.include_router(router)
client = TestClient(app)

mock_user = {
    "id": "user-1",
    "role": "authenticated",
    "email": "user@test.com",
}


class MockSupabaseTableCommonSpace:
    def __init__(self, rows):
        self._all_rows = rows
        self._rows = list(rows)
        self._operation = "select"
        self._payload = None

    def select(self, *args, **kwargs):
        self._operation = "select"
        return self

    def order(self, *args, **kwargs):
        return self

    def eq(self, column, value, **kwargs):
        self._rows = [row for row in self._rows if row.get(column) == value]
        return self

    def limit(self, *args, **kwargs):
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

    def execute(self):
        class MockResponse:
            def __init__(self, data):
                self.data = data

        if self._operation == "insert":
            new_row = {
                "id": 3,
                "name": self._payload["name"],
                "requires_qr": self._payload.get("requires_qr", False),
                "created_at": "2026-03-17T10:00:00",
            }
            self._all_rows.append(new_row)
            return MockResponse([new_row])

        if self._operation == "update":
            updated_rows = []
            for row in self._rows:
                updated_row = row.copy()
                updated_row.update(self._payload)
                updated_rows.append(updated_row)
            if updated_rows:
                updated_ids = {row["id"] for row in updated_rows}
                self._all_rows[:] = [
                    next((updated for updated in updated_rows if updated["id"] == row["id"]), row)
                    if row["id"] in updated_ids
                    else row
                    for row in self._all_rows
                ]
            return MockResponse(updated_rows)

        if self._operation == "delete":
            deleted_rows = list(self._rows)
            deleted_ids = {row["id"] for row in deleted_rows}
            self._all_rows[:] = [row for row in self._all_rows if row["id"] not in deleted_ids]
            return MockResponse(deleted_rows)

        return MockResponse(self._rows)


class MockSupabaseClientCommonSpace:
    def __init__(self):
        self.common_spaces = [
            {
                "id": 1,
                "name": "Piscina",
                "requires_qr": True,
                "created_at": "2026-03-15T09:00:00",
            },
            {
                "id": 2,
                "name": "Gimnasio",
                "requires_qr": False,
                "created_at": "2026-03-16T09:00:00",
            },
        ]

    def table(self, name: str):
        if name != "common_space":
            raise AssertionError(f"Unexpected table requested: {name}")
        return MockSupabaseTableCommonSpace(self.common_spaces)


@pytest.fixture(autouse=True)
def setup_overrides():
    mock_client = MockSupabaseClientCommonSpace()

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: mock_client
    app.dependency_overrides[get_supabase_admin] = lambda: mock_client

    yield

    app.dependency_overrides.clear()


def test_list_common_spaces():
    response = client.get("/common-spaces")

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["name"] == "Piscina"


def test_get_common_space_by_id():
    response = client.get("/common-spaces/1")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["requires_qr"] is True


def test_create_common_space():
    response = client.post(
        "/common-spaces",
        json={
            "name": "Sala comun",
            "requires_qr": True,
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["id"] == 3
    assert data["name"] == "Sala comun"
    assert data["requires_qr"] is True


def test_update_common_space():
    response = client.put(
        "/common-spaces/2",
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


def test_delete_common_space():
    response = client.delete("/common-spaces/1")

    assert response.status_code == 204
