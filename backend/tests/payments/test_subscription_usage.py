import os
from typing import Any
from uuid import UUID

os.environ.setdefault("SUPABASE_URL", "http://localhost:8000")
os.environ.setdefault("SUPABASE_KEY", "dummy")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "dummy-service")

from api.payments import subscriptions as subscriptions_api  # noqa: E402


class MockResponse:
    def __init__(self, data: list[dict[str, Any]]):
        self.data = data


class MockSupabaseTable:
    def __init__(self, table_name: str, storage: dict[str, list[dict[str, Any]]]):
        self._table_name = table_name
        self._storage = storage
        self._filters: list[tuple[str, Any]] = []
        self._limit: int | None = None

    def select(self, *args, **kwargs):
        return self

    def eq(self, column: str, value: Any, **kwargs):
        self._filters.append((column, value))
        return self

    def limit(self, value: int, *args, **kwargs):
        self._limit = value
        return self

    def execute(self):
        rows = [
            row for row in self._storage[self._table_name] if all(row.get(col) == val for col, val in self._filters)
        ]
        if self._limit is not None:
            rows = rows[: self._limit]
        return MockResponse([dict(row) for row in rows])


class MockSupabaseClient:
    def __init__(self, storage: dict[str, list[dict[str, Any]]]):
        self.storage = storage

    def table(self, name: str):
        if name not in self.storage:
            raise AssertionError(f"Unexpected table requested: {name}")
        return MockSupabaseTable(name, self.storage)


def build_client(with_counters: bool) -> MockSupabaseClient:
    storage: dict[str, list[dict[str, Any]]] = {
        "memberships": [
            {
                "profile_id": "11111111-1111-1111-1111-111111111110",
                "association_id": "11111111-1111-1111-1111-111111111111",
                "role": 1,
            }
        ],
        "community_subscriptions": [
            {
                "id": "sub-1",
                "association_id": "11111111-1111-1111-1111-111111111111",
                "subscription_plan_id": "plan-1",
                "status": "active",
            }
        ],
        "subscription_plans": [
            {
                "id": "plan-1",
                "code": "premium",
                "display_name": "Plan Premium",
                "base_cents": 4000,
                "per_household_cents": 100,
                "minutes_seconds_per_month": 7200,
                "minutes_seconds_cap": 21600,
                "chatbot_base_msg": 100,
                "chatbot_per_household_msg": 5,
                "chatbot_input_chars": 1000,
                "chatbot_output_chars": 1000,
            }
        ],
        "neighborhood_associations": [
            {
                "id": "11111111-1111-1111-1111-111111111111",
                "household_count": 20,
            }
        ],
        "community_usage_counters": [],
    }
    if with_counters:
        storage["community_usage_counters"].append(
            {
                "community_subscription_id": "sub-1",
                "chatbot_messages_quota": 180,
                "chatbot_messages_used": 10,
                "minutes_seconds_balance": 9000,
                "minutes_seconds_used": 600,
                "minutes_seconds_cap": 21600,
                "period_started_at": "2026-05-01T00:00:00+00:00",
                "period_ends_at": "2026-06-01T00:00:00+00:00",
                "last_reset_at": "2026-05-01T00:00:00+00:00",
            }
        )
    return MockSupabaseClient(storage)


def test_get_subscription_usage_returns_plan_fallback_without_counters():
    response = subscriptions_api.get_subscription_usage(
        community_id=UUID("11111111-1111-1111-1111-111111111111"),
        current_user={"id": "11111111-1111-1111-1111-111111111110"},
        supabase_admin=build_client(with_counters=False),
    )

    assert response["chatbot"]["quota"] == 200
    assert response["chatbot"]["remaining"] == 200
    assert response["minutes"]["balance_seconds"] == 7200
    assert response["minutes"]["remaining_seconds"] == 7200
    assert response["minutes"]["cap_seconds"] == 21600
    assert response["period_ends_at"] is None


def test_get_subscription_usage_prefers_persisted_counters_when_present():
    response = subscriptions_api.get_subscription_usage(
        community_id=UUID("11111111-1111-1111-1111-111111111111"),
        current_user={"id": "11111111-1111-1111-1111-111111111110"},
        supabase_admin=build_client(with_counters=True),
    )

    assert response["chatbot"]["quota"] == 180
    assert response["chatbot"]["remaining"] == 170
    assert response["minutes"]["balance_seconds"] == 9000
    assert response["minutes"]["remaining_seconds"] == 8400
    assert response["period_ends_at"] == "2026-06-01T00:00:00+00:00"
