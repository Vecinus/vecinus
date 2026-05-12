from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from schemas.polls.polls import PollCreate, PollPublish
from schemas.polls.votes import VoteCreate
from services.polls.escrutinio_service import EscrutinioService
from services.polls.poll_service import PollService
from services.polls.vote_service import VoteService


class MockSupabaseQueryBuilder:
    """Simula el comportamiento encadenado de Supabase: table().select().eq().execute()"""

    def __init__(self, data=None):
        self._data = data if data is not None else []

    def select(self, *args, **kwargs):
        return self

    def update(self, *args, **kwargs):
        return self

    def insert(self, *args, **kwargs):
        inserted = args[0] if isinstance(args[0], list) else [args[0]]
        for item in inserted:
            if "id" not in item:
                item["id"] = "mocked-id"
        return MockSupabaseQueryBuilder(inserted)

    def eq(self, *args, **kwargs):
        return self

    def in_(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def is_(self, *args, **kwargs):
        return self

    @property
    def not_(self):
        return self

    def execute(self):
        mock_response = MagicMock()
        mock_response.data = self._data
        return mock_response


class MockSupabaseClient:
    def __init__(self, db_state):
        self.db_state = db_state

    def table(self, table_name):
        return MockSupabaseQueryBuilder(self.db_state.get(table_name, []))


def test_create_poll_success():
    client = MockSupabaseClient({"poll": []})
    service = PollService(client)

    poll_data = PollCreate(title="Votación de Pintura", options=["Blanco", "Gris"])
    result = service.create_poll(uuid4(), uuid4(), poll_data)

    assert result["title"] == "Votación de Pintura"
    assert result["status"] == "DRAFT"
    assert result["options"] == ["Blanco", "Gris"]


def test_get_polls_by_community():
    db_state = {"poll": [{"id": "p1", "title": "P1"}, {"id": "p2", "title": "P2"}]}
    client = MockSupabaseClient(db_state)
    service = PollService(client)

    polls = service.get_polls_by_community(uuid4())
    assert len(polls) == 2
    assert polls[0]["title"] == "P1"


def test_publish_poll_sends_emails_and_excludes_defaulters():
    db_state = {
        "poll": [{"id": "poll-123", "association_id": "assoc-123", "title": "Votación Vinculante"}],
        "neighborhood_associations": [{"name": "Comunidad Vecinus"}],
        "memberships": [
            {
                "id": "mem-1",
                "profiles": {"email": "voter1@test.com", "username": "voter1"},
                "properties": {"is_defaulter": False},
            },
            {
                "id": "mem-2",
                "profiles": {"email": "moroso@test.com", "username": "moroso"},
                "properties": {"is_defaulter": True},
            },
        ],
        "voting_tokens": [{"token": "mocked"}],
    }
    client = MockSupabaseClient(db_state)
    service = PollService(client)

    now = datetime.now(timezone.utc)
    pub_data = PollPublish(start_at=now, end_at=now + timedelta(days=1), absentees_end_at=now + timedelta(days=14))

    poll_id = uuid4()
    with patch("services.polls.poll_service.send_voting_email") as mock_send_email:
        result = service.publish_poll(poll_id, pub_data)

        assert result["title"] == "Votación Vinculante"
        mock_send_email.assert_called_once_with(
            to_email="voter1@test.com",
            association_name="Comunidad Vecinus",
            poll_title="Votación Vinculante",
            token=mock_send_email.call_args.kwargs["token"],
            poll_id=str(poll_id),
            association_id="assoc-123",
        )


def test_close_poll_manually():
    db_state = {"poll": [{"id": "poll-123", "status": "MANUALLY_CLOSED"}]}
    client = MockSupabaseClient(db_state)
    service = PollService(client)

    result = service.close_poll_manually(uuid4())
    assert result["status"] == "MANUALLY_CLOSED"


def test_cast_vote_success():
    now = datetime.now(timezone.utc)
    db_state = {
        "voting_tokens": [
            {"is_used": False, "expires_at": (now + timedelta(days=1)).isoformat(), "membership_id": "mem-1"}
        ],
        "poll": [{"options": ["A Favor", "En Contra"], "association_id": "assoc-1"}],
        "memberships": [{"property_id": "prop-1"}],
        "properties": [{"coefficient": 15.5, "is_defaulter": False}],
        "vote": [],
    }
    client = MockSupabaseClient(db_state)
    service = VoteService(client)

    vote_data = VoteCreate(selected_option="A Favor", voting_token=str(uuid4()), rgpd_accepted=True)
    result = service.cast_vote(uuid4(), vote_data)

    assert result["selected_option"] == "A Favor"
    assert result["coefficient_snapshot"] == 15.5


def test_cast_vote_rgpd_required():
    client = MockSupabaseClient({})
    service = VoteService(client)
    vote_data = VoteCreate(selected_option="A Favor", voting_token=str(uuid4()), rgpd_accepted=False)

    with pytest.raises(HTTPException) as exc:
        service.cast_vote(uuid4(), vote_data)
    assert exc.value.status_code == 400
    assert "RGPD" in exc.value.detail


def test_cast_vote_token_invalid():
    db_state = {
        "voting_tokens": [],
        "poll": [{"options": ["A Favor", "En Contra"], "association_id": "assoc-1"}],
    }
    client = MockSupabaseClient(db_state)
    service = VoteService(client)
    vote_data = VoteCreate(selected_option="A Favor", voting_token=str(uuid4()), rgpd_accepted=True)

    with pytest.raises(HTTPException) as exc:
        service.cast_vote(uuid4(), vote_data)
    assert exc.value.status_code == 404
    assert "inválido" in exc.value.detail


def test_cast_vote_token_used():
    now = datetime.now(timezone.utc)
    db_state = {
        "voting_tokens": [
            {"is_used": True, "expires_at": (now + timedelta(days=1)).isoformat(), "membership_id": "mem-1"}
        ],
        "poll": [{"options": ["A Favor", "En Contra"], "association_id": "assoc-1"}],
    }
    client = MockSupabaseClient(db_state)
    service = VoteService(client)
    vote_data = VoteCreate(selected_option="A Favor", voting_token=str(uuid4()), rgpd_accepted=True)

    with pytest.raises(HTTPException) as exc:
        service.cast_vote(uuid4(), vote_data)
    assert exc.value.status_code == 403
    assert "utilizado" in exc.value.detail


def test_cast_vote_token_expired():
    now = datetime.now(timezone.utc)
    db_state = {
        "voting_tokens": [
            {
                "is_used": False,
                "expires_at": (now - timedelta(days=1)).isoformat(),
                "membership_id": "mem-1",
            }
        ],
        "poll": [{"options": ["A Favor", "En Contra"], "association_id": "assoc-1"}],
    }
    client = MockSupabaseClient(db_state)
    service = VoteService(client)
    vote_data = VoteCreate(selected_option="A Favor", voting_token=str(uuid4()), rgpd_accepted=True)

    with pytest.raises(HTTPException) as exc:
        service.cast_vote(uuid4(), vote_data)
    assert exc.value.status_code == 403
    assert "expirado" in exc.value.detail


def test_cast_vote_defaulter_forbidden_by_lph():
    now = datetime.now(timezone.utc)
    db_state = {
        "voting_tokens": [
            {"is_used": False, "expires_at": (now + timedelta(days=1)).isoformat(), "membership_id": "mem-1"}
        ],
        "poll": [{"options": ["A Favor", "En Contra"], "association_id": "assoc-1"}],
        "memberships": [{"property_id": "prop-1"}],
        "properties": [{"coefficient": 10.0, "is_defaulter": True}],
    }
    client = MockSupabaseClient(db_state)
    service = VoteService(client)
    vote_data = VoteCreate(selected_option="A Favor", voting_token=str(uuid4()), rgpd_accepted=True)

    with pytest.raises(HTTPException) as exc:
        service.cast_vote(uuid4(), vote_data)
    assert exc.value.status_code == 403
    assert "Art. 15.2 LPH" in exc.value.detail


def test_calculate_results_success():
    db_state = {
        "poll": [{"options": ["A Favor", "En Contra", "Abstención"]}],
        "memberships": [
            {"property_id": "p1", "properties": {"coefficient": 10.0, "is_defaulter": False}},
            {"property_id": "p2", "properties": {"coefficient": 20.0, "is_defaulter": False}},
            {"property_id": "p3", "properties": {"coefficient": 5.0, "is_defaulter": True}},
        ],
        "vote": [
            {
                "selected_option": "A Favor",
                "coefficient_snapshot": 10.0,
                "is_presumed_vote": False,
                "memberships": {"properties": {"number": "1A"}},
            },
            {
                "selected_option": "En Contra",
                "coefficient_snapshot": 20.0,
                "is_presumed_vote": True,
                "memberships": {"properties": {"number": "2B"}},
            },
        ],
    }
    client = MockSupabaseClient(db_state)
    service = EscrutinioService(client)

    results = service.calculate_results(uuid4(), uuid4())

    assert results["census_eligible_voters"] == 2
    assert results["census_eligible_coefficient"] == 30.0
    assert results["total_votes_cast"] == 2
    assert results["presumed_votes_applied"] == 1

    assert len(results["voters_list"]) == 2
    assert results["voters_list"][0]["property_number"] == "1A"
