import os
import sys
import types
from importlib import metadata
from typing import Any
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

import services.payments.gocardless_service as gocardless_service  # noqa: E402
from api.payments.payments import router as payments_router  # noqa: E402
from core.config import settings  # noqa: E402
from core.deps import get_current_user, get_supabase_admin  # noqa: E402

app = FastAPI()
app.include_router(payments_router)
client = TestClient(app)

USER_ID = "11111111-1111-1111-1111-111111111110"
COMMUNITY_1 = "11111111-1111-1111-1111-111111111111"


class MockResponse:
    def __init__(self, data):
        self.data = data


class MockSupabaseTable:
    def __init__(self, table_name: str, storage: dict[str, list[dict[str, Any]]]):
        self._table_name = table_name
        self._storage = storage
        self._operation = "select"
        self._payload = None
        self._filters: list[tuple[str, Any]] = []
        self._limit: int | None = None
        self._order_column: str | None = None

    def select(self, *args, **kwargs):
        if self._operation not in {"insert", "update"}:
            self._operation = "select"
        return self

    def eq(self, column, value, **kwargs):
        self._filters.append((column, value))
        return self

    def limit(self, value, *args, **kwargs):
        self._limit = value
        return self

    def order(self, column, *args, **kwargs):
        self._order_column = column
        return self

    def insert(self, payload, *args, **kwargs):
        self._operation = "insert"
        self._payload = payload
        return self

    def update(self, payload, *args, **kwargs):
        self._operation = "update"
        self._payload = payload
        return self

    def _matches(self, row: dict[str, Any]) -> bool:
        for column, value in self._filters:
            if row.get(column) != value:
                return False
        return True

    def _filtered_rows(self) -> list[dict[str, Any]]:
        rows = [row for row in self._storage[self._table_name] if self._matches(row)]
        if self._order_column is not None:
            rows.sort(key=lambda row: row.get(self._order_column))
        if self._limit is not None:
            rows = rows[: self._limit]
        return rows

    def execute(self):
        if self._operation == "insert":
            payloads = self._payload if isinstance(self._payload, list) else [self._payload]
            inserted = []
            for payload in payloads:
                row = dict(payload)
                row.setdefault("id", str(uuid4()))
                row.setdefault("created_at", "2026-04-04T10:00:00+00:00")
                row.setdefault("updated_at", "2026-04-04T10:00:00+00:00")
                self._storage[self._table_name].append(row)
                inserted.append(dict(row))
            return MockResponse(inserted)

        if self._operation == "update":
            updated = []
            for row in self._storage[self._table_name]:
                if self._matches(row):
                    row.update(self._payload)
                    row["updated_at"] = "2026-04-04T10:05:00+00:00"
                    updated.append(dict(row))
            return MockResponse(updated)

        return MockResponse([dict(row) for row in self._filtered_rows()])


class MockSupabasePaymentsClient:
    def __init__(self):
        self.storage: dict[str, list[dict[str, Any]]] = {
            "memberships": [
                {
                    "id": str(uuid4()),
                    "profile_id": USER_ID,
                    "association_id": COMMUNITY_1,
                    "role": 1,
                    "created_at": "2026-04-04T09:00:00+00:00",
                    "updated_at": "2026-04-04T09:00:00+00:00",
                }
            ],
            "community_pricing_rules": [
                {
                    "id": str(uuid4()),
                    "community_position_from": 2,
                    "community_position_to": 2,
                    "price_cents": 3500,
                    "currency": "EUR",
                    "is_active": True,
                },
                {
                    "id": str(uuid4()),
                    "community_position_from": 3,
                    "community_position_to": 3,
                    "price_cents": 3295,
                    "currency": "EUR",
                    "is_active": True,
                },
                {
                    "id": str(uuid4()),
                    "community_position_from": 4,
                    "community_position_to": 4,
                    "price_cents": 3095,
                    "currency": "EUR",
                    "is_active": True,
                },
                {
                    "id": str(uuid4()),
                    "community_position_from": 5,
                    "community_position_to": None,
                    "price_cents": 2895,
                    "currency": "EUR",
                    "is_active": True,
                },
            ],
            "extra_community_payment_orders": [],
            "extra_community_order_items": [],
            "neighborhood_associations": [],
        }

    def table(self, name: str):
        if name not in self.storage:
            raise AssertionError(f"Unexpected table requested: {name}")
        return MockSupabaseTable(name, self.storage)


@pytest.fixture(autouse=True)
def setup_overrides(monkeypatch):
    state = {
        "user": {
            "id": USER_ID,
            "role": "authenticated",
            "email": "admin@test.com",
        },
        "client": MockSupabasePaymentsClient(),
    }

    monkeypatch.setattr(settings, "GOCARDLESS_ACCESS_TOKEN", "sandbox-token")
    monkeypatch.setattr(settings, "APP_BASE_URL", "http://localhost:8081")
    monkeypatch.setattr(settings, "GOCARDLESS_EXIT_URI", "http://localhost:8081")
    monkeypatch.setattr(settings, "MULTICOMMUNITY_CURRENCY", "EUR")

    app.dependency_overrides[get_current_user] = lambda: state["user"]
    app.dependency_overrides[get_supabase_admin] = lambda: state["client"]

    yield state

    app.dependency_overrides.clear()


def test_create_extra_community_order_uses_escalated_pricing(setup_overrides, monkeypatch):
    def fake_gocardless_request(method: str, path: str, payload=None, idempotency_key=None):
        if path == "/billing_requests":
            return {"billing_requests": {"id": "BR123", "status": "pending"}}
        if path == "/billing_request_flows":
            return {
                "billing_request_flows": {
                    "id": "BRF123",
                    "authorisation_url": "https://sandbox.gocardless.test/flow/abc",
                }
            }
        raise AssertionError(f"Unexpected GoCardless request: {method} {path}")

    monkeypatch.setattr(gocardless_service, "_gocardless_request", fake_gocardless_request)

    response = client.post(
        "/payments/community-extras/orders",
        json={
            "quantity": 2,
            "communities": [
                {"name": "Comunidad Sol", "address": "Calle Sol 1"},
                {"name": "Comunidad Luna", "address": "Calle Luna 2"},
            ],
        },
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "redirect_created"
    assert data["billing_request_id"] == "BR123"
    assert data["billing_request_flow_id"] == "BRF123"
    assert data["authorisation_url"] == "https://sandbox.gocardless.test/flow/abc"
    assert data["unit_amount_cents"] == 3500
    assert data["total_amount_cents"] == 6795
    assert [item["price_cents"] for item in data["items"]] == [3500, 3295]


def test_complete_extra_community_order_creates_communities_and_memberships(setup_overrides, monkeypatch):
    state = setup_overrides
    order_id = str(uuid4())
    state["client"].storage["extra_community_payment_orders"] = [
        {
            "id": order_id,
            "admin_profile_id": USER_ID,
            "quantity": 2,
            "unit_amount_cents": 3500,
            "total_amount_cents": 6795,
            "currency": "EUR",
            "provider": "gocardless",
            "billing_request_id": "BR123",
            "billing_request_flow_id": "BRF123",
            "mandate_id": None,
            "payment_id": None,
            "authorisation_url": "https://sandbox.gocardless.test/flow/abc",
            "status": "redirect_created",
            "created_at": "2026-04-04T10:00:00+00:00",
            "updated_at": "2026-04-04T10:00:00+00:00",
        }
    ]
    state["client"].storage["extra_community_order_items"] = [
        {
            "id": str(uuid4()),
            "payment_order_id": order_id,
            "community_name": "Comunidad Sol",
            "community_address": "Calle Sol 1",
            "price_cents": 3500,
            "status": "pending",
            "created_association_id": None,
            "created_at": "2026-04-04T10:00:00+00:00",
            "updated_at": "2026-04-04T10:00:00+00:00",
        },
        {
            "id": str(uuid4()),
            "payment_order_id": order_id,
            "community_name": "Comunidad Luna",
            "community_address": "Calle Luna 2",
            "price_cents": 3295,
            "status": "pending",
            "created_association_id": None,
            "created_at": "2026-04-04T10:00:00+00:00",
            "updated_at": "2026-04-04T10:00:00+00:00",
        },
    ]

    def fake_gocardless_request(method: str, path: str, payload=None, idempotency_key=None):
        if method == "GET" and path == "/billing_requests/BR123":
            return {
                "billing_requests": {
                    "id": "BR123",
                    "status": "fulfilled",
                    "links": {"mandate": "MD123"},
                }
            }
        if method == "POST" and path == "/payments":
            return {"payments": {"id": "PM123"}}
        raise AssertionError(f"Unexpected GoCardless request: {method} {path}")

    monkeypatch.setattr(gocardless_service, "_gocardless_request", fake_gocardless_request)

    response = client.post(f"/payments/community-extras/orders/{order_id}/complete")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "paid"
    assert data["mandate_id"] == "MD123"
    assert data["payment_id"] == "PM123"
    assert all(item["status"] == "created" for item in data["items"])
    assert len(state["client"].storage["neighborhood_associations"]) == 2
    created_names = [item["name"] for item in state["client"].storage["neighborhood_associations"]]
    assert created_names == ["Comunidad Sol", "Comunidad Luna"]

    admin_memberships = [m for m in state["client"].storage["memberships"] if m["role"] == 1]
    assert len(admin_memberships) == 3
