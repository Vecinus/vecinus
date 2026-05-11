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
    return types.SimpleNamespace(email=email, normalized=email, local_part=email.split("@")[0])


email_validator_stub.EmailNotValidError = EmailNotValidError
email_validator_stub.validate_email = validate_email
sys.modules["email_validator"] = email_validator_stub

original_version = metadata.version


def patched_version(distribution_name: str) -> str:
    if distribution_name == "email-validator":
        return "2.0.0"
    return original_version(distribution_name)


metadata.version = patched_version
pydantic.networks.version = patched_version

import services.payments.activation_gocardless_service as activation_service  # noqa: E402
import services.payments.usage_counters_service as usage_counters_service  # noqa: E402
from api.payments.subscriptions import router as subscriptions_router  # noqa: E402
from core.config import settings  # noqa: E402
from core.deps import get_current_user, get_supabase_admin  # noqa: E402

app = FastAPI()
app.include_router(subscriptions_router)
client = TestClient(app)

ASSOCIATION_ID = "11111111-1111-1111-1111-111111111111"
PROFILE_ID = "11111111-1111-1111-1111-111111111110"
PLAN_BASIC_ID = "22222222-2222-2222-2222-222222222222"
ORDER_1_ID = "33333333-3333-3333-3333-333333333331"
ORDER_2_ID = "33333333-3333-3333-3333-333333333332"
ORDER_3_ID = "33333333-3333-3333-3333-333333333333"
ORDER_4_ID = "33333333-3333-3333-3333-333333333334"
EXISTING_SUBSCRIPTION_ID = "44444444-4444-4444-4444-444444444444"


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

        return MockResponse([dict(row) for row in self._filtered_rows()])


class MockSupabaseAdminClient:
    def __init__(self):
        self.storage: dict[str, list[dict[str, Any]]] = {
            "registration_payment_orders": [],
            "profiles": [],
            "neighborhood_associations": [],
            "memberships": [],
            "properties": [],
            "community_subscriptions": [],
            "community_usage_counters": [],
            "subscription_plans": [],
        }
        self.rpc_calls: list[tuple[str, dict[str, Any]]] = []

    def table(self, name: str):
        if name not in self.storage:
            raise AssertionError(f"Unexpected table requested: {name}")
        return MockSupabaseTable(name, self.storage)

    def rpc(self, name: str, payload: dict[str, Any]):
        self.rpc_calls.append((name, payload))
        return types.SimpleNamespace(execute=lambda: MockResponse([]))


@pytest.fixture(autouse=True)
def setup_overrides(monkeypatch):
    state = {
        "admin_client": MockSupabaseAdminClient(),
        "current_user": {"id": PROFILE_ID, "email": "admin@vecinus.test"},
    }
    admin_client: MockSupabaseAdminClient = state["admin_client"]
    admin_client.storage["profiles"].append({"id": PROFILE_ID, "username": "admin"})
    admin_client.storage["neighborhood_associations"].append(
        {
            "id": ASSOCIATION_ID,
            "name": "Comunidad Alameda",
            "address": "Calle Alameda 10",
            "household_count": 12,
        }
    )
    admin_client.storage["memberships"].append(
        {"id": "membership-1", "profile_id": PROFILE_ID, "association_id": ASSOCIATION_ID, "role": 1}
    )
    admin_client.storage["subscription_plans"].append(
        {
            "id": PLAN_BASIC_ID,
            "code": "basic",
            "display_name": "Basic",
            "base_cents": 3000,
            "per_household_cents": 100,
            "minutes_seconds_per_month": 7200,
            "minutes_seconds_cap": 21600,
            "chatbot_base_msg": 100,
            "chatbot_per_household_msg": 5,
            "chatbot_input_chars": 1000,
            "chatbot_output_chars": 1000,
            "is_active": True,
        }
    )

    monkeypatch.setattr(settings, "APP_BASE_URL", "http://localhost:8081")
    monkeypatch.setattr(settings, "MULTICOMMUNITY_CURRENCY", "EUR")
    app.dependency_overrides[get_supabase_admin] = lambda: state["admin_client"]
    app.dependency_overrides[get_current_user] = lambda: state["current_user"]

    yield state

    app.dependency_overrides.clear()


def test_create_activation_order_returns_gocardless_redirect(setup_overrides, monkeypatch):
    def fake_create_mandate_billing_request(metadata=None, idempotency_key=None):
        assert metadata["association_id"] == ASSOCIATION_ID
        return {"id": "BR-LEG-1"}

    def fake_create_billing_request_flow(billing_request_id: str, redirect_uri: str, idempotency_key=None):
        assert billing_request_id == "BR-LEG-1"
        assert "activation_order_id=" in redirect_uri
        return {"id": "BRF-LEG-1", "authorisation_url": "https://sandbox.gocardless.test/flow/legacy-1"}

    monkeypatch.setattr(activation_service, "create_mandate_billing_request", fake_create_mandate_billing_request)
    monkeypatch.setattr(activation_service, "create_billing_request_flow", fake_create_billing_request_flow)

    response = client.post(
        f"/payments/subscriptions/{ASSOCIATION_ID}/activation-orders",
        json={"plan": "basic", "household_count": 24},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["status"] == "redirect_created"
    assert data["created_association_id"] == ASSOCIATION_ID
    assert data["billing_request_id"] == "BR-LEG-1"
    assert data["billing_request_flow_id"] == "BRF-LEG-1"
    assert data["authorisation_url"] == "https://sandbox.gocardless.test/flow/legacy-1"
    assert data["amount_cents"] == 5400


def test_create_activation_order_fails_if_subscription_already_exists(setup_overrides):
    admin_client: MockSupabaseAdminClient = setup_overrides["admin_client"]
    admin_client.storage["community_subscriptions"].append({"id": "sub-1", "association_id": ASSOCIATION_ID})

    response = client.post(
        f"/payments/subscriptions/{ASSOCIATION_ID}/activation-orders",
        json={"plan": "basic", "household_count": 24},
    )

    assert response.status_code == 409


def test_create_activation_order_fails_if_household_count_is_below_existing_properties(setup_overrides):
    admin_client: MockSupabaseAdminClient = setup_overrides["admin_client"]
    admin_client.storage["properties"].extend(
        [
            {"id": "prop-1", "association_id": ASSOCIATION_ID},
            {"id": "prop-2", "association_id": ASSOCIATION_ID},
            {"id": "prop-3", "association_id": ASSOCIATION_ID},
        ]
    )

    response = client.post(
        f"/payments/subscriptions/{ASSOCIATION_ID}/activation-orders",
        json={"plan": "basic", "household_count": 2},
    )

    assert response.status_code == 409
    data = response.json()["detail"]
    assert data["code"] == "household_limit_below_current_usage"
    assert data["current_count"] == 3
    assert data["requested_limit"] == 2


def test_complete_activation_order_creates_subscription_and_updates_household_count(setup_overrides, monkeypatch):
    admin_client: MockSupabaseAdminClient = setup_overrides["admin_client"]
    admin_client.storage["registration_payment_orders"].append(
        {
            "id": ORDER_1_ID,
            "email": "admin@vecinus.test",
            "username": "admin",
            "community_name": "Comunidad Alameda",
            "community_address": "Calle Alameda 10",
            "amount_cents": 5400,
            "currency": "EUR",
            "provider": "gocardless",
            "status": "redirect_created",
            "granted_role": 1,
            "subscription_plan_id": PLAN_BASIC_ID,
            "household_count": 24,
            "created_profile_id": PROFILE_ID,
            "created_association_id": ASSOCIATION_ID,
            "billing_request_id": "BR-LEG-1",
            "created_at": "2026-04-08T10:00:00+00:00",
            "updated_at": "2026-04-08T10:00:00+00:00",
        }
    )

    monkeypatch.setattr(
        activation_service,
        "get_billing_request",
        lambda billing_request_id: {
            "id": billing_request_id,
            "status": "fulfilled",
            "links": {"mandate_request_mandate": "md-1"},
        },
    )
    monkeypatch.setattr(
        activation_service, "get_mandate", lambda mandate_id: {"id": mandate_id, "links": {"customer": "cus-1"}}
    )
    monkeypatch.setattr(
        activation_service,
        "_ensure_gocardless_subscription",
        lambda supabase_admin, cs_row, order, mandate_id, amount_cents: dict(
            cs_row, gocardless_subscription_id="gc-sub-1"
        ),
    )

    response = client.post(f"/payments/subscriptions/activation-orders/{ORDER_1_ID}/complete")

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert data["created_subscription_id"] is not None
    assert admin_client.storage["neighborhood_associations"][0]["household_count"] == 24
    assert len(admin_client.storage["community_subscriptions"]) == 1
    assert admin_client.storage["community_subscriptions"][0]["status"] == "pending_first_payment"
    assert admin_client.rpc_calls == [
        ("reset_usage_counters", {"p_subscription_id": data["created_subscription_id"]}),
        ("reset_usage_counters", {"p_subscription_id": data["created_subscription_id"]}),
    ]


def test_complete_activation_order_is_idempotent(setup_overrides, monkeypatch):
    admin_client: MockSupabaseAdminClient = setup_overrides["admin_client"]
    admin_client.storage["registration_payment_orders"].append(
        {
            "id": ORDER_2_ID,
            "email": "admin@vecinus.test",
            "username": "admin",
            "community_name": "Comunidad Alameda",
            "community_address": "Calle Alameda 10",
            "amount_cents": 5400,
            "currency": "EUR",
            "provider": "gocardless",
            "status": "completed",
            "granted_role": 1,
            "subscription_plan_id": PLAN_BASIC_ID,
            "household_count": 24,
            "created_profile_id": PROFILE_ID,
            "created_association_id": ASSOCIATION_ID,
            "created_subscription_id": EXISTING_SUBSCRIPTION_ID,
            "billing_request_id": "BR-LEG-2",
            "created_at": "2026-04-08T10:00:00+00:00",
            "updated_at": "2026-04-08T10:00:00+00:00",
        }
    )

    called = {"count": 0}

    def fake_get_billing_request(_):
        called["count"] += 1
        return {"status": "fulfilled", "links": {"mandate_request_mandate": "md-2"}}

    monkeypatch.setattr(activation_service, "get_billing_request", fake_get_billing_request)

    response = client.post(f"/payments/subscriptions/activation-orders/{ORDER_2_ID}/complete")

    assert response.status_code == 200
    assert response.json()["created_subscription_id"] == EXISTING_SUBSCRIPTION_ID
    assert called["count"] == 0


def test_complete_activation_order_retries_usage_counter_initialization(monkeypatch, setup_overrides):
    admin_client: MockSupabaseAdminClient = setup_overrides["admin_client"]
    admin_client.storage["registration_payment_orders"].append(
        {
            "id": ORDER_3_ID,
            "email": "admin@vecinus.test",
            "username": "admin",
            "community_name": "Comunidad Alameda",
            "community_address": "Calle Alameda 10",
            "amount_cents": 5400,
            "currency": "EUR",
            "provider": "gocardless",
            "status": "redirect_created",
            "granted_role": 1,
            "subscription_plan_id": PLAN_BASIC_ID,
            "household_count": 24,
            "created_profile_id": PROFILE_ID,
            "created_association_id": ASSOCIATION_ID,
            "billing_request_id": "BR-LEG-3",
            "created_at": "2026-04-08T10:00:00+00:00",
            "updated_at": "2026-04-08T10:00:00+00:00",
        }
    )

    monkeypatch.setattr(
        activation_service,
        "get_billing_request",
        lambda billing_request_id: {
            "id": billing_request_id,
            "status": "fulfilled",
            "links": {"mandate_request_mandate": "md-3"},
        },
    )
    monkeypatch.setattr(
        activation_service, "get_mandate", lambda mandate_id: {"id": mandate_id, "links": {"customer": "cus-3"}}
    )
    monkeypatch.setattr(
        activation_service,
        "_ensure_gocardless_subscription",
        lambda supabase_admin, cs_row, order, mandate_id, amount_cents: dict(
            cs_row, gocardless_subscription_id="gc-sub-3"
        ),
    )

    attempts = {"count": 0}

    def fake_reset(_admin, subscription_id):
        attempts["count"] += 1
        if attempts["count"] == 2:
            admin_client.storage.setdefault("community_usage_counters", []).append(
                {"community_subscription_id": subscription_id}
            )

    monkeypatch.setattr(usage_counters_service, "reset_usage_counters", fake_reset)

    response = client.post(f"/payments/subscriptions/activation-orders/{ORDER_3_ID}/complete")

    assert response.status_code == 200
    assert attempts["count"] == 2


def test_complete_activation_order_bootstraps_usage_counters_when_rpc_never_creates_them(monkeypatch, setup_overrides):
    admin_client: MockSupabaseAdminClient = setup_overrides["admin_client"]
    admin_client.storage["registration_payment_orders"].append(
        {
            "id": ORDER_4_ID,
            "email": "admin@vecinus.test",
            "username": "admin",
            "community_name": "Comunidad Alameda",
            "community_address": "Calle Alameda 10",
            "amount_cents": 5400,
            "currency": "EUR",
            "provider": "gocardless",
            "status": "redirect_created",
            "granted_role": 1,
            "subscription_plan_id": PLAN_BASIC_ID,
            "household_count": 24,
            "created_profile_id": PROFILE_ID,
            "created_association_id": ASSOCIATION_ID,
            "billing_request_id": "BR-LEG-4",
            "created_at": "2026-04-08T10:00:00+00:00",
            "updated_at": "2026-04-08T10:00:00+00:00",
        }
    )

    monkeypatch.setattr(
        activation_service,
        "get_billing_request",
        lambda billing_request_id: {
            "id": billing_request_id,
            "status": "fulfilled",
            "links": {"mandate_request_mandate": "md-4"},
        },
    )
    monkeypatch.setattr(
        activation_service, "get_mandate", lambda mandate_id: {"id": mandate_id, "links": {"customer": "cus-4"}}
    )
    monkeypatch.setattr(
        activation_service,
        "_ensure_gocardless_subscription",
        lambda supabase_admin, cs_row, order, mandate_id, amount_cents: dict(
            cs_row, gocardless_subscription_id="gc-sub-4"
        ),
    )
    monkeypatch.setattr(usage_counters_service, "reset_usage_counters", lambda *_args, **_kwargs: None)

    response = client.post(f"/payments/subscriptions/activation-orders/{ORDER_4_ID}/complete")

    assert response.status_code == 200
    assert len(admin_client.storage["community_usage_counters"]) == 1
    counters = admin_client.storage["community_usage_counters"][0]
    assert counters["chatbot_messages_quota"] == 220
    assert counters["minutes_seconds_balance"] == 7200
