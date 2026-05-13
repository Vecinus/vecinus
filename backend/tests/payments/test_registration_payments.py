import os
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

# email_validator_stub removed

original_version = metadata.version


def patched_version(distribution_name: str) -> str:
    if distribution_name == "email-validator":
        return "2.0.0"
    return original_version(distribution_name)


metadata.version = patched_version
pydantic.networks.version = patched_version

import services.payments.registration_gocardless_service as registration_service  # noqa: E402
from api.auth.registration import router as registration_router  # noqa: E402
from core.config import settings  # noqa: E402
from core.deps import (  # noqa: E402
    get_current_user,
    get_supabase_admin,
    get_supabase_anon,
)

app = FastAPI()
app.include_router(registration_router)
client = TestClient(app)

PROFILE_ID = "11111111-1111-1111-1111-111111111110"
OTHER_PROFILE_ID = "11111111-1111-1111-1111-111111111119"
PLAN_BASIC_ID = "22222222-2222-2222-2222-222222222222"
SUBSCRIPTION_ID = "33333333-3333-3333-3333-333333333333"


def expect_equal(actual, expected, message: str, response=None) -> None:
    if actual != expected:
        if response:
            print("Response body:", response.json())
        pytest.fail(f"{message} (actual={actual!r}, expected={expected!r})")


def expect_true(condition: bool, message: str) -> None:
    if not condition:
        pytest.fail(message)


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

    def select(self, *args, **kwargs):
        if self._operation not in {"insert", "update", "upsert"}:
            self._operation = "select"
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

    def upsert(self, payload, *args, **kwargs):
        self._operation = "upsert"
        self._payload = payload
        return self

    def _matches(self, row: dict[str, Any]) -> bool:
        for column, value in self._filters:
            if row.get(column) != value:
                return False
        return True

    def _filtered_rows(self) -> list[dict[str, Any]]:
        rows = [row for row in self._storage[self._table_name] if self._matches(row)]
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
                row.setdefault("created_at", "2026-04-08T10:00:00+00:00")
                row.setdefault("updated_at", "2026-04-08T10:00:00+00:00")
                self._storage[self._table_name].append(row)
                inserted.append(dict(row))
            return MockResponse(inserted)

        if self._operation == "update":
            updated = []
            for row in self._storage[self._table_name]:
                if self._matches(row):
                    row.update(self._payload)
                    row["updated_at"] = "2026-04-08T10:05:00+00:00"
                    updated.append(dict(row))
            return MockResponse(updated)

        if self._operation == "upsert":
            payload = dict(self._payload)
            existing = next(
                (row for row in self._storage[self._table_name] if row.get("id") == payload.get("id")), None
            )
            if existing:
                existing.update(payload)
                existing["updated_at"] = "2026-04-08T10:05:00+00:00"
                return MockResponse([dict(existing)])
            payload.setdefault("created_at", "2026-04-08T10:00:00+00:00")
            payload.setdefault("updated_at", "2026-04-08T10:00:00+00:00")
            self._storage[self._table_name].append(payload)
            return MockResponse([dict(payload)])

        return MockResponse([dict(row) for row in self._filtered_rows()])


class MockAuthAdmin:
    def __init__(self):
        self._users: list[types.SimpleNamespace] = []

    def list_users(self):
        return list(self._users)

    def create_user(self, payload: dict[str, Any]):
        user = types.SimpleNamespace(id=str(uuid4()), email=payload["email"])
        self._users.append(user)
        return types.SimpleNamespace(user=user)


class MockSupabaseAdminClient:
    def __init__(self):
        self.storage: dict[str, list[dict[str, Any]]] = {
            "registration_payment_orders": [],
            "profiles": [],
            "neighborhood_associations": [],
            "memberships": [],
            "subscription_plans": [],
            "community_subscriptions": [],
            "community_usage_counters": [],
        }
        self.auth = types.SimpleNamespace(admin=MockAuthAdmin())

    def table(self, name: str):
        if name not in self.storage:
            raise AssertionError(f"Unexpected table requested: {name}")
        return MockSupabaseTable(name, self.storage)


class MockSupabaseAnonClient:
    def __init__(self):
        self.auth = types.SimpleNamespace(sign_in_with_password=self._sign_in_with_password)

    def _sign_in_with_password(self, payload: dict[str, Any]):
        session = types.SimpleNamespace(access_token=f"token-for-{payload['email']}")
        return types.SimpleNamespace(session=session)


@pytest.fixture(autouse=True)
def setup_overrides(monkeypatch):
    state = {
        "admin_client": MockSupabaseAdminClient(),
        "anon_client": MockSupabaseAnonClient(),
        "current_user": {"id": PROFILE_ID, "email": "nuevo@vecinus.com", "role": "authenticated"},
    }

    monkeypatch.setattr(settings, "GOCARDLESS_ACCESS_TOKEN", "sandbox-token")
    monkeypatch.setattr(settings, "APP_BASE_URL", "http://localhost:8081")
    monkeypatch.setattr(settings, "GOCARDLESS_EXIT_URI", "http://localhost:8081")
    monkeypatch.setattr(settings, "MULTICOMMUNITY_CURRENCY", "EUR")
    monkeypatch.setattr(settings, "REGISTRATION_PAYMENT_AMOUNT_CENTS", 1499)

    state["admin_client"].storage["profiles"].append({"id": PROFILE_ID, "username": "nuevo_admin"})
    state["admin_client"].storage["subscription_plans"].append(
        {
            "id": PLAN_BASIC_ID,
            "code": "basic",
            "display_name": "Basic",
            "base_cents": 1499,
            "per_household_cents": 0,
            "minutes_seconds_per_month": 7200,
            "minutes_seconds_cap": 21600,
            "chatbot_base_msg": 100,
            "chatbot_per_household_msg": 5,
            "chatbot_input_chars": 1000,
            "chatbot_output_chars": 1000,
            "is_active": True,
        }
    )

    app.dependency_overrides[get_supabase_admin] = lambda: state["admin_client"]
    app.dependency_overrides[get_supabase_anon] = lambda: state["anon_client"]
    app.dependency_overrides[get_current_user] = lambda: state["current_user"]

    yield state

    app.dependency_overrides.clear()


def test_create_registration_order_returns_gocardless_redirect(setup_overrides, monkeypatch):
    monkeypatch.setattr(
        registration_service,
        "create_mandate_billing_request",
        lambda metadata=None, idempotency_key=None: {"id": "BR-REG-1", "status": "pending"},
    )
    monkeypatch.setattr(
        registration_service,
        "create_billing_request_flow",
        lambda billing_request_id, redirect_uri, idempotency_key=None: {
            "id": "BRF-REG-1",
            "authorisation_url": "https://sandbox.gocardless.test/flow/register-1",
        },
    )

    response = client.post(
        "/registration/gocardless/orders",
        json={
            "community_name": "Comunidad Alameda",
            "community_address": "Calle Alameda 10",
            "plan": "basic",
            "household_count": 1,
        },
    )

    print("--- RESPONSE JSON ---", response.json())
    expect_equal(response.status_code, 201, "Expected status code 201", response=response)
    data = response.json()
    expect_equal(data["status"], "redirect_created", "Expected redirect status")
    expect_equal(data["billing_request_id"], "BR-REG-1", "Expected billing request id")
    expect_equal(data["billing_request_flow_id"], "BRF-REG-1", "Expected billing request flow id")
    expect_equal(
        data["authorisation_url"],
        "https://sandbox.gocardless.test/flow/register-1",
        "Expected authorisation URL",
    )
    expect_equal(data["amount_cents"], 1499, "Expected configured amount")
    expect_equal(data["granted_role"], 1, "Expected admin role")
    expect_equal(data["granted_role_label"], "admin", "Expected admin role label")


def test_create_registration_order_fails_if_email_already_used(setup_overrides, monkeypatch):
    setup_overrides["current_user"]["email"] = None

    response = client.post(
        "/registration/gocardless/orders",
        json={
            "community_name": "Comunidad Alatrillo",
            "community_address": "Calle Varvo 33",
        },
    )
    expect_equal(response.status_code, 400, "Expected status code 400")
    data = response.json()
    expect_equal(data["detail"], "Authenticated user has no email available in the JWT", "Expected error message")


def test_complete_registration_order_creates_user_community_and_membership(setup_overrides, monkeypatch):
    state = setup_overrides
    order_id = str(uuid4())
    state["admin_client"].storage["registration_payment_orders"] = [
        {
            "id": order_id,
            "email": "nuevo@example.com",
            "username": "nuevo_admin",
            "community_name": "Comunidad Alameda",
            "community_address": "Calle Alameda 10",
            "amount_cents": 1499,
            "currency": "EUR",
            "provider": "gocardless",
            "status": "redirect_created",
            "billing_request_id": "BR-REG-1",
            "billing_request_flow_id": "BRF-REG-1",
            "authorisation_url": "https://sandbox.gocardless.test/flow/register-1",
            "mandate_id": None,
            "payment_id": None,
            "created_profile_id": PROFILE_ID,
            "created_association_id": None,
            "granted_role": 1,
            "subscription_plan_id": PLAN_BASIC_ID,
            "household_count": 1,
            "created_at": "2026-04-08T10:00:00+00:00",
            "updated_at": "2026-04-08T10:00:00+00:00",
        }
    ]
    monkeypatch.setattr(
        registration_service,
        "get_billing_request",
        lambda _billing_request_id: {
            "id": "BR-REG-1",
            "status": "fulfilled",
            "links": {"mandate_request_mandate": "MD-REG-1"},
        },
    )
    monkeypatch.setattr(registration_service, "get_mandate", lambda _mandate_id: {"links": {"customer": "CUS-1"}})
    monkeypatch.setattr(registration_service, "create_subscription", lambda **_kwargs: {"id": "GC-SUB-1"})
    monkeypatch.setattr(registration_service, "ensure_usage_counters_initialized", lambda *_args, **_kwargs: True)

    response = client.post(f"/registration/gocardless/orders/{order_id}/complete")

    expect_equal(response.status_code, 200, "Expected status code 200")
    data = response.json()
    expect_equal(data["status"], "completed", "Expected completed status")
    expect_equal(data["mandate_id"], "MD-REG-1", "Expected mandate id")
    expect_equal(data["granted_role"], 1, "Expected admin role")
    expect_equal(data["granted_role_label"], "admin", "Expected admin role label")
    expect_equal(data["created_profile_id"], PROFILE_ID, "Expected current profile id")
    expect_true(data["created_association_id"] is not None, "Expected created association id")
    expect_true(data["created_subscription_id"] is not None, "Expected created subscription id")
    expect_equal(data["token"], None, "Expected no auth token")
    expect_equal(len(state["admin_client"].storage["profiles"]), 1, "Expected no extra profiles")
    expect_equal(
        len(state["admin_client"].storage["neighborhood_associations"]),
        1,
        "Expected one created community",
    )
    expect_equal(len(state["admin_client"].storage["memberships"]), 1, "Expected one created membership")
    expect_equal(state["admin_client"].storage["memberships"][0]["role"], 1, "Expected created admin membership")
    expect_equal(len(state["admin_client"].storage["community_subscriptions"]), 1, "Expected one subscription row")


def test_complete_registration_order_completed(setup_overrides, monkeypatch):
    order_id = str(uuid4())
    str(uuid4())
    created_association_id = str(uuid4())
    setup_overrides["admin_client"].storage["registration_payment_orders"] = [
        {
            "id": order_id,
            "email": "nuevo@example.com",
            "username": "nuevo_admin",
            "community_name": "Comunidad Alameda",
            "community_address": "Calle Alameda 10",
            "amount_cents": 1499,
            "currency": "EUR",
            "provider": "gocardless",
            "status": "completed",
            "billing_request_id": "BR-REG-1",
            "billing_request_flow_id": "BRF-REG-1",
            "authorisation_url": "https://sandbox.gocardless.test/flow/register-1",
            "mandate_id": "MD-REG-1",
            "payment_id": "PM-REG-1",
            "created_profile_id": PROFILE_ID,
            "created_association_id": created_association_id,
            "granted_role": 1,
            "subscription_plan_id": PLAN_BASIC_ID,
            "household_count": 1,
            "created_subscription_id": SUBSCRIPTION_ID,
            "created_at": "2026-04-08T10:00:00+00:00",
            "updated_at": "2026-04-08T10:00:00+00:00",
        }
    ]

    response = client.post(f"/registration/gocardless/orders/{order_id}/complete")
    expect_equal(response.status_code, 200, "Expected status code 200")
    data = response.json()
    expect_equal(data["status"], "completed", "Expected completed status")
    expect_equal(data["mandate_id"], "MD-REG-1", "Expected existing mandate id")
    expect_equal(data["granted_role"], 1, "Expected admin role")
    expect_equal(data["granted_role_label"], "admin", "Expected admin role label")
    expect_equal(data["created_profile_id"], PROFILE_ID, "Expected existing created profile id")
    expect_equal(data["created_association_id"], created_association_id, "Expected existing created association id")
    expect_equal(data["token"], None, "Expected no auth token")


def test_complete_registration_order_fails_if_order_not_found(setup_overrides, monkeypatch):
    response = client.post(
        f"/registration/gocardless/orders/{str(uuid4())}/complete",
    )
    expect_equal(response.status_code, 404, "Expected status code 404")
    data = response.json()
    expect_equal(data["detail"], "Registration payment order not found", "Expected error message")


def test_complete_registration_order_fails_if_order_lacks_billing_request(setup_overrides, monkeypatch):
    order_id = str(uuid4())
    setup_overrides["admin_client"].storage["registration_payment_orders"] = [
        {
            "id": order_id,
            "email": "nuevo@example.com",
            "username": "nuevo_admin",
            "community_name": "Comunidad Alameda",
            "community_address": "Calle Alameda 10",
            "amount_cents": 1499,
            "currency": "EUR",
            "provider": "gocardless",
            "status": "redirect_created",
            "billing_request_id": None,
            "billing_request_flow_id": None,
            "authorisation_url": None,
            "subscription_plan_id": PLAN_BASIC_ID,
            "household_count": 1,
            "created_at": "2026-04-08T10:00:00+00:00",
            "updated_at": "2026-04-08T10:00:00+00:00",
        }
    ]

    response = client.post(f"/registration/gocardless/orders/{order_id}/complete")
    expect_equal(response.status_code, 400, "Expected status code 400")
    data = response.json()
    expect_equal(
        data["detail"], "The registration order has no GoCardless billing request yet", "Expected error message"
    )


def test_complete_registration_order_fails_if_email_already_used(setup_overrides, monkeypatch):
    order_id = str(uuid4())
    setup_overrides["admin_client"].storage["registration_payment_orders"] = [
        {
            "id": order_id,
            "email": "nuevo@example.com",
            "username": "otro admin",
            "community_name": "Comunidad Alatrillo",
            "community_address": "Calle Varvo 33",
            "amount_cents": 1499,
            "currency": "EUR",
            "provider": "gocardless",
            "status": "redirect_created",
            "billing_request_id": "BR-REG-2",
            "billing_request_flow_id": "BF-REG-2",
            "authorisation_url": "https://example.com/authorise2",
            "subscription_plan_id": PLAN_BASIC_ID,
            "household_count": 1,
            "created_profile_id": OTHER_PROFILE_ID,
            "created_at": "2026-04-08T10:00:00+00:00",
            "updated_at": "2026-04-08T10:00:00+00:00",
        },
    ]

    response = client.post(f"/registration/gocardless/orders/{order_id}/complete")
    expect_equal(response.status_code, 403, "Expected status code 403")
    data = response.json()
    expect_equal(data["detail"], "This order belongs to another user", "Expected error message")


def test_complete_registration_order_fails_if_email_mismatch(setup_overrides, monkeypatch):
    order_id = str(uuid4())
    setup_overrides["admin_client"].storage["registration_payment_orders"] = [
        {
            "id": order_id,
            "email": "nuevo@example.com",
            "username": "nuevo_admin",
            "community_name": "Comunidad Alameda",
            "community_address": "Calle Alameda 10",
            "amount_cents": 1499,
            "currency": "EUR",
            "provider": "gocardless",
            "status": "redirect_created",
            "billing_request_id": "BR-REG-1",
            "billing_request_flow_id": "BF-REG-1",
            "authorisation_url": "https://example.com/authorise",
            "subscription_plan_id": PLAN_BASIC_ID,
            "household_count": 1,
            "created_profile_id": PROFILE_ID,
            "created_at": "2026-04-08T10:00:00+00:00",
            "updated_at": "2026-04-08T10:00:00+00:00",
        }
    ]

    monkeypatch.setattr(
        registration_service,
        "get_billing_request",
        lambda _billing_request_id: {
            "id": "BR-REG-1",
            "status": "pending",
            "links": {},
        },
    )

    response = client.post(f"/registration/gocardless/orders/{order_id}/complete")
    expect_equal(response.status_code, 200, "Expected status code 200")
    data = response.json()
    expect_equal(data["status"], "pending", "Expected pending status")
