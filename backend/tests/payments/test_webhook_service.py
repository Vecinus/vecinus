from __future__ import annotations

from typing import Any

import services.payments.webhook_service as webhook_service


class MockResponse:
    def __init__(self, data: list[dict[str, Any]]):
        self.data = data


class MockSupabaseTable:
    def __init__(self, table_name: str, storage: dict[str, list[dict[str, Any]]]):
        self._table_name = table_name
        self._storage = storage
        self._operation = "select"
        self._payload: dict[str, Any] | None = None
        self._filters: list[tuple[str, Any]] = []
        self._limit: int | None = None

    def select(self, *args, **kwargs):
        if self._operation not in {"insert", "update"}:
            self._operation = "select"
        return self

    def eq(self, column: str, value: Any, **kwargs):
        self._filters.append((column, value))
        return self

    def limit(self, value: int, *args, **kwargs):
        self._limit = value
        return self

    def insert(self, payload: dict[str, Any], *args, **kwargs):
        self._operation = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict[str, Any], *args, **kwargs):
        self._operation = "update"
        self._payload = payload
        return self

    def _matches(self, row: dict[str, Any]) -> bool:
        return all(row.get(column) == value for column, value in self._filters)

    def _filtered_rows(self) -> list[dict[str, Any]]:
        rows = [row for row in self._storage[self._table_name] if self._matches(row)]
        if self._limit is not None:
            rows = rows[: self._limit]
        return rows

    def execute(self):
        if self._operation == "insert":
            row = dict(self._payload or {})
            row.setdefault("id", f"{self._table_name}-id-{len(self._storage[self._table_name]) + 1}")
            self._storage[self._table_name].append(row)
            return MockResponse([dict(row)])

        if self._operation == "update":
            updated = []
            for row in self._storage[self._table_name]:
                if self._matches(row):
                    row.update(self._payload or {})
                    updated.append(dict(row))
            return MockResponse(updated)

        return MockResponse([dict(row) for row in self._filtered_rows()])


class MockSupabaseClient:
    def __init__(self, storage: dict[str, list[dict[str, Any]]]):
        self.storage = storage

    def table(self, name: str):
        if name not in self.storage:
            raise AssertionError(f"Unexpected table requested: {name}")
        return MockSupabaseTable(name, self.storage)


def build_client(invoice_status: str | None = None, include_renewal_tables: bool = False) -> MockSupabaseClient:
    storage: dict[str, list[dict[str, Any]]] = {
        "community_subscriptions": [
            {
                "id": "sub-1",
                "association_id": "assoc-1",
                "subscription_plan_id": "plan-1",
                "gocardless_subscription_id": "gc-sub-1",
                "current_amount_cents": 2000,
                "status": "past_due" if invoice_status == "failed" else "pending_first_payment",
                "failure_count": 1 if invoice_status == "failed" else 0,
                "last_payment_at": None,
            }
        ],
        "community_usage_counters": [
            {
                "id": "counter-1",
                "community_subscription_id": "sub-1",
            }
        ],
        "subscription_invoices": [],
    }
    if include_renewal_tables:
        storage["subscription_plans"] = [
            {
                "id": "plan-1",
                "base_cents": 2000,
                "per_household_cents": 100,
            }
        ]
        storage["neighborhood_associations"] = [
            {
                "id": "assoc-1",
                "name": "Comunidad Uno",
                "household_count": 20,
            }
        ]
    if invoice_status is not None:
        storage["subscription_invoices"].append(
            {
                "id": "inv-1",
                "community_subscription_id": "sub-1",
                "gocardless_payment_id": "pay-1",
                "status": invoice_status,
                "amount_cents": 2000,
                "currency": "EUR",
            }
        )
    return MockSupabaseClient(storage)


def test_confirmed_new_payment_resets_usage_once(monkeypatch):
    client = build_client(invoice_status=None)
    reset_calls: list[str] = []

    monkeypatch.setattr(
        webhook_service,
        "get_payment",
        lambda payment_id: {
            "id": payment_id,
            "amount": 2000,
            "currency": "EUR",
            "charge_date": "2026-05-10",
            "links": {"subscription": "gc-sub-1"},
        },
    )
    monkeypatch.setattr(webhook_service, "_now_iso", lambda: "2026-05-10T12:00:00+00:00")
    monkeypatch.setattr(webhook_service, "_reset_usage_counters", lambda _admin, sub_id: reset_calls.append(sub_id))

    webhook_service._handle_payment_confirmed(client, {"links": {"payment": "pay-1"}})

    assert reset_calls == ["sub-1"]
    assert client.storage["community_subscriptions"][0]["status"] == "active"
    assert client.storage["community_subscriptions"][0]["failure_count"] == 0
    assert client.storage["subscription_invoices"][0]["status"] == "confirmed"


def test_confirmed_recovered_failed_payment_does_not_reset_usage(monkeypatch):
    client = build_client(invoice_status="failed")
    reset_calls: list[str] = []

    monkeypatch.setattr(webhook_service, "_now_iso", lambda: "2026-05-10T12:00:00+00:00")
    monkeypatch.setattr(webhook_service, "_reset_usage_counters", lambda _admin, sub_id: reset_calls.append(sub_id))

    webhook_service._handle_payment_confirmed(client, {"links": {"payment": "pay-1"}})

    assert reset_calls == []
    assert client.storage["community_subscriptions"][0]["status"] == "active"
    assert client.storage["community_subscriptions"][0]["failure_count"] == 0
    assert client.storage["subscription_invoices"][0]["status"] == "confirmed"


def test_confirmed_recovered_failed_payment_initializes_missing_usage_counters(monkeypatch):
    client = build_client(invoice_status="failed")
    client.storage["community_usage_counters"] = []
    reset_calls: list[str] = []

    monkeypatch.setattr(webhook_service, "_now_iso", lambda: "2026-05-10T12:00:00+00:00")
    monkeypatch.setattr(webhook_service, "_reset_usage_counters", lambda _admin, sub_id: reset_calls.append(sub_id))

    webhook_service._handle_payment_confirmed(client, {"links": {"payment": "pay-1"}})

    assert reset_calls == ["sub-1"]
    assert client.storage["community_subscriptions"][0]["status"] == "active"
    assert client.storage["community_subscriptions"][0]["failure_count"] == 0
    assert client.storage["subscription_invoices"][0]["status"] == "confirmed"


def test_confirmed_duplicate_webhook_does_not_reset_usage(monkeypatch):
    client = build_client(invoice_status="confirmed")
    reset_calls: list[str] = []

    monkeypatch.setattr(webhook_service, "_now_iso", lambda: "2026-05-10T12:00:00+00:00")
    monkeypatch.setattr(webhook_service, "_reset_usage_counters", lambda _admin, sub_id: reset_calls.append(sub_id))

    webhook_service._handle_payment_confirmed(client, {"links": {"payment": "pay-1"}})

    assert reset_calls == []
    assert client.storage["community_subscriptions"][0]["status"] == "active"
    assert client.storage["subscription_invoices"][0]["status"] == "confirmed"


def test_subscription_renewal_retries_missing_usage_counters(monkeypatch):
    client = build_client(include_renewal_tables=True)
    client.storage["community_subscriptions"][0]["gocardless_mandate_id"] = "old-md"
    reset_calls: list[str] = []

    monkeypatch.setattr(webhook_service, "_now_iso", lambda: "2026-05-10T12:00:00+00:00")
    monkeypatch.setattr(webhook_service, "get_mandate", lambda mandate_id: {"links": {"customer": "cus-1"}})
    monkeypatch.setattr(webhook_service, "cancel_subscription", lambda *args, **kwargs: None)
    monkeypatch.setattr(webhook_service, "create_subscription", lambda **kwargs: {"id": "gc-sub-2"})

    def fake_reset(_admin, sub_id):
        reset_calls.append(sub_id)
        if len(reset_calls) == 2:
            client.storage["community_usage_counters"].append({"id": "counter-2", "community_subscription_id": sub_id})

    monkeypatch.setattr(webhook_service, "_reset_usage_counters", fake_reset)

    webhook_service._process_subscription_renewal(client, "sub-1", "new-md")

    assert reset_calls == ["sub-1", "sub-1"]
    assert client.storage["community_subscriptions"][0]["status"] == "active"
    assert client.storage["community_subscriptions"][0]["gocardless_mandate_id"] == "new-md"
    assert client.storage["community_subscriptions"][0]["gocardless_subscription_id"] == "gc-sub-2"
