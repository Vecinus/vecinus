import os
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

os.environ["SUPABASE_URL"] = "http://localhost:8000"
os.environ["SUPABASE_KEY"] = "dummy"
os.environ["SUPABASE_SERVICE_KEY"] = "dummy"
os.environ["SUPABASE_SCHEMA"] = "public"

from core.deps import get_current_user, get_supabase, get_supabase_admin  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)

USER_ID = str(uuid4())
ASSOC_ID = str(uuid4())
POLL_ID = str(uuid4())


class MockResponse:
    def __init__(self, data):
        self.data = data


class MockSupabaseTable:
    def __init__(self, rows):
        self._rows = list(rows)

    def select(self, *args, **kwargs):
        return self

    def eq(self, column, value, **kwargs):
        self._rows = [row for row in self._rows if str(row.get(column)) == str(value)]
        return self

    def limit(self, *args, **kwargs):
        return self

    def execute(self):
        return MockResponse(self._rows)


class MockSupabaseClient:
    def __init__(self):
        self.storage = {
            "community_subscriptions": [{"association_id": ASSOC_ID, "status": "active"}],
            "memberships": [{"association_id": ASSOC_ID, "profile_id": USER_ID, "role": 1}],
            "poll": [{"id": POLL_ID, "association_id": ASSOC_ID, "status": "DRAFT", "title": "Nueva Votación"}],
            "voting_tokens": [{"token": "public-token", "poll_id": POLL_ID, "expires_at": None, "used_at": None}],
        }

    def table(self, name: str):
        return MockSupabaseTable(self.storage.get(name, []))


def override_get_current_user():
    return {"id": USER_ID, "role": "authenticated", "email": "admin@test.com"}


def override_get_supabase():
    return MockSupabaseClient()


def make_supabase_with_subscription(status: str | None):
    client = MockSupabaseClient()
    if status is None:
        client.storage["community_subscriptions"] = []
    else:
        client.storage["community_subscriptions"] = [{"association_id": ASSOC_ID, "status": status}]
    return client


@pytest.fixture(autouse=True)
def setup_overrides():
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_supabase] = override_get_supabase
    app.dependency_overrides[get_supabase_admin] = override_get_supabase
    yield
    app.dependency_overrides.clear()


@patch("api.polls.polls.RoleService.verify_admin_or_president_permissions")
@patch("api.polls.polls.PollService")
def test_api_create_poll(mock_poll_service_class, mock_verify):
    mock_service = mock_poll_service_class.return_value
    mock_service.create_poll.return_value = {
        "id": POLL_ID,
        "association_id": ASSOC_ID,
        "created_by": USER_ID,
        "db_status": "DRAFT",
        "created_at": "2026-04-03T12:00:00Z",
        "title": "Nueva Votación",
        "options": ["Sí", "No"],
    }

    response = client.post(f"/polls/associations/{ASSOC_ID}", json={"title": "Nueva Votación", "options": ["Sí", "No"]})

    assert response.status_code == 201
    data = response.json()
    assert data["id"] == POLL_ID
    assert data["title"] == "Nueva Votación"
    assert data["current_status"] == "DRAFT"
    mock_verify.assert_called_once()
    mock_service.create_poll.assert_called_once()


@patch("api.polls.polls.PollService")
def test_api_get_polls(mock_poll_service_class):
    mock_service = mock_poll_service_class.return_value
    mock_service.get_polls_by_community.return_value = [
        {
            "id": POLL_ID,
            "association_id": ASSOC_ID,
            "created_by": USER_ID,
            "db_status": "PUBLISHED",
            "created_at": "2026-04-03T12:00:00Z",
            "start_at": "2026-04-01T12:00:00Z",
            "end_at": "2030-04-03T12:00:00Z",
            "absentees_end_at": "2030-04-10T12:00:00Z",
            "title": "Votación Activa",
            "options": ["Sí", "No"],
        }
    ]

    response = client.get(f"/polls/associations/{ASSOC_ID}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["current_status"] == "ACTIVE"


def test_api_get_polls_without_subscription_returns_402():
    app.dependency_overrides[get_supabase] = lambda: make_supabase_with_subscription(None)
    app.dependency_overrides[get_supabase_admin] = lambda: make_supabase_with_subscription(None)

    response = client.get(f"/polls/associations/{ASSOC_ID}")

    assert response.status_code == 402
    assert response.json()["detail"]["code"] == "community_no_subscription"


def test_api_get_polls_with_blocked_subscription_returns_402():
    app.dependency_overrides[get_supabase] = lambda: make_supabase_with_subscription("past_due")
    app.dependency_overrides[get_supabase_admin] = lambda: make_supabase_with_subscription("past_due")

    response = client.get(f"/polls/associations/{ASSOC_ID}")

    assert response.status_code == 402
    assert response.json()["detail"]["code"] == "community_blocked"


@patch("api.polls.polls.VoteService")
def test_api_cast_vote(mock_vote_service_class):
    mock_service = mock_vote_service_class.return_value
    mock_service.cast_vote.return_value = {
        "id": str(uuid4()),
        "poll_id": POLL_ID,
        "membership_id": str(uuid4()),
        "selected_option": "Sí",
        "coefficient_snapshot": 15.5,
        "is_presumed_vote": False,
        "rgpd_accepted_at": "2026-04-03T12:00:00Z",
        "created_at": "2026-04-03T12:00:00Z",
    }

    token = str(uuid4())
    response = client.post(
        f"/polls/{POLL_ID}/vote", json={"selected_option": "Sí", "voting_token": token, "rgpd_accepted": True}
    )

    assert response.status_code == 201
    data = response.json()
    assert data["selected_option"] == "Sí"
    assert data["coefficient_snapshot"] == 15.5

    mock_service.cast_vote.assert_called_once()
    mock_service.cast_vote.assert_called_once()


def test_api_get_public_poll_without_subscription_returns_402():
    app.dependency_overrides[get_supabase] = lambda: make_supabase_with_subscription(None)
    app.dependency_overrides[get_supabase_admin] = lambda: make_supabase_with_subscription(None)

    response = client.get(f"/polls/public/{POLL_ID}", params={"token": "public-token"})

    assert response.status_code == 402
    assert response.json()["detail"]["code"] == "community_no_subscription"


@patch("api.polls.polls.VoteService")
def test_api_cast_vote_with_blocked_subscription_returns_402(mock_vote_service_class):
    app.dependency_overrides[get_supabase] = lambda: make_supabase_with_subscription("past_due")
    app.dependency_overrides[get_supabase_admin] = lambda: make_supabase_with_subscription("past_due")

    response = client.post(
        f"/polls/{POLL_ID}/vote", json={"selected_option": "Sí", "voting_token": str(uuid4()), "rgpd_accepted": True}
    )

    assert response.status_code == 402
    assert response.json()["detail"]["code"] == "community_blocked"
    mock_vote_service_class.return_value.cast_vote.assert_not_called()


@patch("api.polls.polls.PollService")
def test_api_get_poll_by_id_without_subscription_returns_402(mock_poll_service_class):
    app.dependency_overrides[get_supabase] = lambda: make_supabase_with_subscription(None)
    app.dependency_overrides[get_supabase_admin] = lambda: make_supabase_with_subscription(None)

    response = client.get(f"/polls/{POLL_ID}")

    assert response.status_code == 402
    assert response.json()["detail"]["code"] == "community_no_subscription"
    mock_poll_service_class.return_value.get_poll_by_id.assert_not_called()
