from datetime import time

import pytest
from pydantic import ValidationError
from schemas.common_space.common_spaces import CommonSpaceCreate, CommonSpaceUpdate


def test_common_space_create_rejects_negative_capacity():
    with pytest.raises(ValidationError):
        CommonSpaceCreate(name="Piscina", requires_qr=True, capacity=-1)


def test_common_space_create_rejects_inverted_hours():
    with pytest.raises(ValidationError):
        CommonSpaceCreate(
            name="Piscina",
            requires_qr=True,
            start_time=time(20, 0),
            end_time=time(9, 0),
        )


def test_common_space_create_rejects_partial_hours():
    with pytest.raises(ValidationError):
        CommonSpaceCreate(name="Piscina", requires_qr=True, start_time=time(9, 0))


def test_common_space_create_accepts_null_hours_as_24h():
    space = CommonSpaceCreate(name="Piscina", requires_qr=True, start_time=None, end_time=None)
    assert space.start_time is None
    assert space.end_time is None


def test_common_space_update_rejects_zero_guest_limit():
    with pytest.raises(ValidationError):
        CommonSpaceUpdate(max_guests_per_reservation=0)


def test_common_space_create_accepts_valid_configuration():
    space = CommonSpaceCreate(
        name="Piscina",
        requires_qr=True,
        capacity=20,
        max_guests_per_reservation=2,
        start_time=time(9, 0),
        end_time=time(20, 0),
    )
    assert space.capacity == 20
