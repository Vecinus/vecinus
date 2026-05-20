from datetime import datetime, timedelta, timezone

import pytest
from pydantic import ValidationError
from schemas.polls.polls import PollCreate, PollPublish


def test_poll_create_rejects_empty_title():
    with pytest.raises(ValidationError):
        PollCreate(title="   ", options=["Si", "No"])


def test_poll_create_rejects_duplicate_options():
    with pytest.raises(ValidationError):
        PollCreate(title="Pintura", options=["Blanco", "Blanco"])


def test_poll_publish_rejects_inverted_dates():
    now = datetime.now(timezone.utc)
    with pytest.raises(ValidationError):
        PollPublish(start_at=now, end_at=now - timedelta(hours=1), absentees_end_at=now + timedelta(days=1))


def test_poll_publish_accepts_ordered_dates():
    now = datetime.now(timezone.utc)
    poll = PollPublish(start_at=now, end_at=now + timedelta(days=1), absentees_end_at=now + timedelta(days=2))
    assert poll.end_at > poll.start_at
