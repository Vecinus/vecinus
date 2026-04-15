import os
from unittest.mock import MagicMock, patch
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


def override_get_current_user():
    return {"id": USER_ID, "role": "authenticated", "email": "admin@test.com"}


def override_get_supabase():
    return MagicMock()


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
