import os
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

# Set dummy env vars for pydantic settings before importing app
os.environ["SUPABASE_URL"] = "http://localhost:8000"
os.environ["SUPABASE_KEY"] = "dummy"
os.environ["SUPABASE_SERVICE_KEY"] = "dummy-service"

from core.deps import get_current_user, get_supabase  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)

# Mocked Data
mock_admin_id = str(uuid4())
mock_neighbor_id = str(uuid4())
mock_tenant_id = str(uuid4())
mock_employee_id = str(uuid4())
mock_president_id = str(uuid4())
mock_association_id = str(uuid4())
mock_other_association_id = str(uuid4())
mock_property_1_id = str(uuid4())
mock_property_2_id = str(uuid4())
mock_property_3_id = str(uuid4())
mock_admin_membership_id = str(uuid4())
mock_neighbor_membership_id = str(uuid4())
mock_tenant_membership_id = str(uuid4())
mock_employee_membership_id = str(uuid4())
mock_president_membership_id = str(uuid4())
mock_incident_1_id = str(uuid4())
mock_incident_2_id = str(uuid4())
mock_incident_3_id = str(uuid4())
mock_incident_4_id = str(uuid4())
mock_incident_5_id = str(uuid4())
mock_incident_6_id = str(uuid4())
mock_incident_7_id = str(uuid4())
mock_incident_8_id = str(uuid4())


mock_admin = {"id": mock_admin_id, "role": "authenticated", "email": "admin@test.com"}

mock_neighbor = {"id": mock_neighbor_id, "role": "authenticated", "email": "neighbor@test.com"}

mock_tenant = {"id": mock_tenant_id, "role": "authenticated", "email": "tenant@test.com"}

mock_employee = {"id": mock_employee_id, "role": "authenticated", "email": "employee@test.com"}

mock_president = {"id": mock_president_id, "role": "authenticated", "email": "president@test.com"}

mock_association = {"id": mock_association_id, "name": "Test Association", "address": "123 Test St"}

mock_other_association = {"id": mock_other_association_id, "name": "Other Association", "address": "456 Other St"}

mock_property_1 = {"id": mock_property_1_id, "number": "123T", "association_id": mock_association_id}

mock_property_2 = {"id": mock_property_2_id, "number": "456T", "association_id": mock_association_id}

mock_property_3 = {"id": mock_property_3_id, "number": "789T", "association_id": mock_association_id}

mock_admin_membership = {
    "id": mock_admin_membership_id,
    "association_id": mock_association_id,
    "profile_id": mock_admin_id,
    "role": "1",  # ADMIN
}

mock_neighbor_membership = {
    "id": mock_neighbor_membership_id,
    "association_id": mock_association_id,
    "profile_id": mock_neighbor_id,
    "property_id": mock_property_1_id,
    "role": "2",  # OWNER
}

mock_tenant_membership = {
    "id": mock_tenant_membership_id,
    "association_id": mock_association_id,
    "profile_id": mock_tenant_id,
    "property_id": mock_property_2_id,
    "role": "3",  # TENANT
}

mock_president_membership = {
    "id": mock_president_membership_id,
    "association_id": mock_association_id,
    "profile_id": mock_president_id,
    "property_id": mock_property_3_id,
    "role": "4",  # PRESIDENT
}

mock_employee_membership = {
    "id": mock_employee_membership_id,
    "association_id": mock_association_id,
    "profile_id": mock_employee_id,
    "role": "5",  # EMPLOYEE
}

mock_other_membership = {
    "id": str(uuid4()),
    "association_id": mock_other_association_id,
    "profile_id": mock_employee_id,
    "role": "2",  # OWNER
}

mock_incident_1 = {
    "id": mock_incident_1_id,
    "type": "OTHER",
    "description": "Loud music at night",
    "created_at": "2026-01-01T12:00:00Z",
    "image_url": None,
    "membership_id": mock_neighbor_membership_id,
}

mock_incident_2 = {
    "id": mock_incident_2_id,
    "type": "ELECTRICITY",
    "description": "Power outage in the building",
    "created_at": "2026-01-02T15:30:00Z",
    "image_url": "https://cdn-icons-png.flaticon.com/256/53/53426.png",
    "membership_id": mock_tenant_membership_id,
}

mock_incident_3 = {
    "id": mock_incident_3_id,
    "type": "POOL",
    "description": "Pool is empty",
    "created_at": "2026-01-03T09:45:00Z",
    "image_url": None,
    "membership_id": mock_tenant_membership_id,
}

mock_incident_4 = {
    "id": mock_incident_4_id,
    "type": "ELEVATOR",
    "description": "Broken elevator",
    "created_at": "2026-01-04T11:20:00Z",
    "image_url": None,
    "membership_id": mock_neighbor_membership_id,
}

mock_incident_5 = {
    "id": mock_incident_5_id,
    "type": "SAFETY",
    "description": "Suspicious person in the parking lot",
    "created_at": "2026-01-05T22:10:00Z",
    "image_url": None,
    "membership_id": mock_employee_membership_id,
}

mock_incident_6 = {
    "id": mock_incident_6_id,
    "type": "WORKERS",
    "description": "Security employee is untrusty",
    "created_at": "2026-01-06T08:00:00Z",
    "image_url": None,
    "membership_id": mock_tenant_membership_id,
}

mock_incident_7 = {
    "id": mock_incident_7_id,
    "type": "PLUMBING",
    "description": "Leaking pipe in the basement",
    "created_at": "2026-01-07T19:30:00Z",
    "image_url": None,
    "membership_id": mock_president_membership_id,
}

mock_incident_8 = {
    "id": mock_incident_8_id,
    "type": "LIGHTING",
    "description": "Street light not working",
    "created_at": "2026-01-08T21:15:00Z",
    "image_url": None,
    "membership_id": mock_tenant_membership_id,
}

mock_incident_state_1_1 = {
    "id": 1,
    "status": "PENDING",
    "created_at": "2026-01-01T12:00:00Z",
    "incident_id": mock_incident_1_id,
}

mock_incident_state_1_2 = {
    "id": 2,
    "status": "DISCARDED",
    "created_at": "2026-01-01T16:45:00Z",
    "incident_id": mock_incident_1_id,
}

mock_incident_state_2_1 = {
    "id": 3,
    "status": "PENDING",
    "created_at": "2026-01-02T15:30:00Z",
    "incident_id": mock_incident_2_id,
}

mock_incident_state_2_2 = {
    "id": 4,
    "status": "IN PROGRESS",
    "created_at": "2026-01-03T10:00:00Z",
    "incident_id": mock_incident_2_id,
}

mock_incident_state_2_3 = {
    "id": 5,
    "status": "SOLVED",
    "created_at": "2026-01-03T14:20:00Z",
    "incident_id": mock_incident_2_id,
}

mock_incident_state_3_1 = {
    "id": 6,
    "status": "PENDING",
    "created_at": "2026-01-03T09:45:00Z",
    "incident_id": mock_incident_3_id,
}

mock_incident_state_4_1 = {
    "id": 7,
    "status": "PENDING",
    "created_at": "2026-01-04T11:20:00Z",
    "incident_id": mock_incident_4_id,
}

mock_incident_state_5_1 = {
    "id": 8,
    "status": "PENDING",
    "created_at": "2026-01-05T22:10:00Z",
    "incident_id": mock_incident_5_id,
}

mock_incident_state_6_1 = {
    "id": 9,
    "status": "PENDING",
    "created_at": "2026-01-06T08:00:00Z",
    "incident_id": mock_incident_6_id,
}

mock_incident_state_7_1 = {
    "id": 10,
    "status": "PENDING",
    "created_at": "2026-01-07T19:30:00Z",
    "incident_id": mock_incident_7_id,
}

mock_incident_state_8_1 = {
    "id": 11,
    "status": "PENDING",
    "created_at": "2026-01-08T21:15:00Z",
    "incident_id": mock_incident_8_id,
}

mock_incident_state_8_2 = {
    "id": 12,
    "status": "IN PROGRESS",
    "created_at": "2026-01-09T10:00:00Z",
    "incident_id": mock_incident_8_id,
}


class MockSupabaseTable:
    def __init__(self, table_name, data, rls_blocked_ops=None):
        self.table_name = table_name
        self._all_data = data
        self._data = list(data)
        self._operation = "select"
        # Operations that raise RLS error: {"insert", "delete", "update"}
        self._rls_blocked_ops = rls_blocked_ops or set()

    def select(self, *args, **kwargs):
        self._operation = "select"
        return self

    def insert(self, row, *args, **kwargs):
        self._operation = "insert"
        from uuid import uuid4

        items = row if isinstance(row, list) else [row]
        self._inserted = []
        for item in items:
            new_item = item.copy()
            if "id" not in new_item:
                new_item["id"] = str(uuid4())
            self._inserted.append(new_item)
        return self

    def eq(self, column, value, **kwargs):
        # Handle nested filters like "memberships.association_id"
        if "." in column:
            parts = column.split(".")
            self._data = [item for item in self._data if str(item.get(parts[0], {}).get(parts[1])) == str(value)]
        else:
            self._data = [item for item in self._data if str(item.get(column)) == str(value)]
        return self

    def update(self, data, *args, **kwargs):
        self._operation = "update"
        self._updated = []
        for item in self._data:
            updated = item.copy()
            updated.update(data)
            self._updated.append(updated)
        if not self._updated:
            self._updated = [{"id": "dummy", **data}]
        return self

    def delete(self, *args, **kwargs):
        self._operation = "delete"
        return self

    def execute(self):
        from postgrest.exceptions import APIError

        if self._operation in self._rls_blocked_ops:
            raise APIError(
                {
                    "code": "42501",
                    "message": "new row violates row-level security policy",
                    "details": None,
                    "hint": None,
                }
            )

        class MockResponse:
            def __init__(self, data):
                self.data = data

        if self._operation == "insert":
            return MockResponse(self._inserted)
        if self._operation == "update":
            return MockResponse(self._updated)
        return MockResponse(self._data)

    def order(self, column, desc=False, foreign_table=None):
        if not foreign_table:
            self._data = sorted(self._data, key=lambda x: x.get(column), reverse=desc)
        else:
            for item in self._data:
                if isinstance(item, dict) and foreign_table in item:
                    related_items = item[foreign_table]
                    if isinstance(related_items, list):
                        item[foreign_table] = sorted(related_items, key=lambda x: x.get(column), reverse=desc)
        return self

    def limit(self, count):
        self._data = self._data[:count]
        return self


class MockSupabaseClient:
    def __init__(self, mock_responses, rls_blocked=None):
        self.mock_responses = mock_responses
        # {"table_name": {"insert", "delete"}} — ops that raise RLS error
        self.rls_blocked = rls_blocked or {}

    def table(self, name: str):
        table = MockSupabaseTable(
            name,
            self.mock_responses.get(name, []),
            rls_blocked_ops=self.rls_blocked.get(name, set()),
        )
        return table


def make_mock_supabase(extra=None, rls_blocked=None):
    base = {
        "memberships": [
            mock_admin_membership,
            mock_neighbor_membership,
            mock_tenant_membership,
            mock_president_membership,
            mock_employee_membership,
            mock_other_membership,
        ],
        "associations": [mock_association, mock_other_association],
        "properties": [mock_property_1, mock_property_2, mock_property_3],
        "profiles": [mock_admin, mock_neighbor, mock_tenant, mock_employee, mock_president],
        "incident_states": [
            mock_incident_state_1_1,
            mock_incident_state_1_2,
            mock_incident_state_2_1,
            mock_incident_state_2_2,
            mock_incident_state_2_3,
            mock_incident_state_3_1,
            mock_incident_state_4_1,
            mock_incident_state_5_1,
            mock_incident_state_6_1,
            mock_incident_state_7_1,
            mock_incident_state_8_1,
            mock_incident_state_8_2,
        ],
    }

    # Build incidents with embedded memberships
    incidents_with_memberships = []
    all_incidents = [
        mock_incident_1,
        mock_incident_2,
        mock_incident_3,
        mock_incident_4,
        mock_incident_5,
        mock_incident_6,
        mock_incident_7,
        mock_incident_8,
    ]

    for incident in all_incidents:
        incident_states = []
        incident_copy = incident.copy()
        # Find the membership for this incident
        membership_id = incident_copy.get("membership_id")
        for membership in base["memberships"]:
            if membership["id"] == membership_id:
                incident_copy["memberships"] = {
                    "association_id": membership["association_id"],
                    "role": membership["role"],
                }
                break
        for state in base["incident_states"]:
            if state["incident_id"] == incident_copy["id"]:
                incident_states.append(state)
        incident_copy["incident_states"] = incident_states
        incidents_with_memberships.append(incident_copy)

    base["incidents"] = incidents_with_memberships

    if extra:
        for key, value in extra.items():
            if key == "incidents":
                # For extra incidents, also add memberships relationship
                for incident in value:
                    incident_copy = incident.copy()
                    membership_id = incident_copy.get("membership_id")
                    for membership in base["memberships"]:
                        if membership["id"] == membership_id:
                            incident_copy["memberships"] = {
                                "association_id": membership["association_id"],
                                "role": membership["role"],
                            }
                            break
                base[key] = base.get(key, []) + [incident_copy]
            else:
                base[key] = base.get(key, []) + value
    return MockSupabaseClient(base, rls_blocked=rls_blocked)


# ------------------- GET incidents/{association_id} ------------------


def test_get_incidents_non_admin_correct():
    app.dependency_overrides[get_current_user] = lambda: mock_tenant
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.get(f"/incidents/{mock_association_id}")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 7  # All incidents but the discarded one should be returned
    incident_ids = {incident["id"] for incident in data}
    assert mock_incident_1_id not in incident_ids  # Discarded
    assert mock_incident_2_id in incident_ids
    assert mock_incident_3_id in incident_ids
    assert mock_incident_4_id in incident_ids
    assert mock_incident_5_id in incident_ids
    assert mock_incident_6_id in incident_ids
    assert mock_incident_7_id in incident_ids
    assert mock_incident_8_id in incident_ids
    attributes = data[0].keys()
    assert "id" in attributes
    assert "type" in attributes
    assert "description" in attributes
    assert "created_at" in attributes
    assert "image_url" in attributes
    assert "membership_id" in attributes
    assert "status" in attributes


def test_get_incidents_admin_correct():
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.get(f"/incidents/{mock_association_id}")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 8  # All incidents should be returned
    incident_ids = {incident["id"] for incident in data}
    assert mock_incident_1_id in incident_ids  # Discarded but admin
    assert mock_incident_2_id in incident_ids
    assert mock_incident_3_id in incident_ids
    assert mock_incident_4_id in incident_ids
    assert mock_incident_5_id in incident_ids
    assert mock_incident_6_id in incident_ids
    assert mock_incident_7_id in incident_ids
    assert mock_incident_8_id in incident_ids


def test_get_incidents_pending_correct():
    app.dependency_overrides[get_current_user] = lambda: mock_tenant
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.get(f"/incidents/{mock_association_id}?status=PENDING")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 5
    incident_ids = {incident["id"] for incident in data}
    assert mock_incident_1_id not in incident_ids  # Discarded
    assert mock_incident_2_id not in incident_ids  # RESOLVED
    assert mock_incident_3_id in incident_ids
    assert mock_incident_4_id in incident_ids
    assert mock_incident_5_id in incident_ids
    assert mock_incident_6_id in incident_ids
    assert mock_incident_7_id in incident_ids
    assert mock_incident_8_id not in incident_ids  # IN_PROGRESS


def test_get_incidents_in_progress_correct():
    app.dependency_overrides[get_current_user] = lambda: mock_employee
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.get(f"/incidents/{mock_association_id}?status=IN%20PROGRESS")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    incident_ids = {incident["id"] for incident in data}
    assert mock_incident_1_id not in incident_ids
    assert mock_incident_2_id not in incident_ids
    assert mock_incident_3_id not in incident_ids
    assert mock_incident_4_id not in incident_ids
    assert mock_incident_5_id not in incident_ids
    assert mock_incident_6_id not in incident_ids
    assert mock_incident_7_id not in incident_ids
    assert mock_incident_8_id in incident_ids  # IN_PROGRESS


def test_get_incidents_solved_correct():
    app.dependency_overrides[get_current_user] = lambda: mock_president
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.get(f"/incidents/{mock_association_id}?status=SOLVED")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    incident_ids = {incident["id"] for incident in data}
    assert mock_incident_1_id not in incident_ids
    assert mock_incident_2_id in incident_ids  # SOLVED
    assert mock_incident_3_id not in incident_ids
    assert mock_incident_4_id not in incident_ids
    assert mock_incident_5_id not in incident_ids
    assert mock_incident_6_id not in incident_ids
    assert mock_incident_7_id not in incident_ids
    assert mock_incident_8_id not in incident_ids


def test_get_incidents_admin_discarded_correct():
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.get(f"/incidents/{mock_association_id}?status=DISCARDED")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    incident_ids = {incident["id"] for incident in data}
    assert mock_incident_1_id in incident_ids
    assert mock_incident_2_id not in incident_ids
    assert mock_incident_3_id not in incident_ids
    assert mock_incident_4_id not in incident_ids
    assert mock_incident_5_id not in incident_ids
    assert mock_incident_6_id not in incident_ids
    assert mock_incident_7_id not in incident_ids
    assert mock_incident_8_id not in incident_ids


def test_get_incidents_mine_correct():
    app.dependency_overrides[get_current_user] = lambda: mock_tenant
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.get(f"/incidents/{mock_association_id}?mine=true")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 4
    incident_ids = {incident["id"] for incident in data}
    assert mock_incident_1_id not in incident_ids
    assert mock_incident_2_id in incident_ids
    assert mock_incident_3_id in incident_ids
    assert mock_incident_4_id not in incident_ids
    assert mock_incident_5_id not in incident_ids
    assert mock_incident_6_id in incident_ids
    assert mock_incident_7_id not in incident_ids
    assert mock_incident_8_id in incident_ids


def test_get_incidents_empty():
    app.dependency_overrides[get_current_user] = lambda: mock_employee
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.get(f"/incidents/{mock_other_association_id}")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 0


def test_get_incidents_wrong_association():
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.get(f"/incidents/{mock_other_association_id}")
    assert response.status_code == 403
    data = response.json()
    assert data["detail"] == "Access denied to this community"


def test_get_incidents_invalid_status():
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.get(f"/incidents/{mock_association_id}?status=INVALID")
    assert response.status_code == 400
    data = response.json()
    assert data["detail"].startswith("Invalid status. Allowed values: {'")
    assert data["detail"].endswith("'}")


def test_get_incidents_discarded_non_admin_forbidden():
    app.dependency_overrides[get_current_user] = lambda: mock_tenant
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.get(f"/incidents/{mock_association_id}?status=DISCARDED")
    assert response.status_code == 403
    data = response.json()
    assert data["detail"] == "Admin access required for this action"


# ------------------- GET incidents/{association_id}/{incident_id} ------------------


def test_get_incident_1_status_correct():
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(
        extra={
            "incidents": [mock_incident_6],
            "incident_states": [mock_incident_state_6_1],
        }
    )
    response = client.get(f"/incidents/{mock_association_id}/{mock_incident_6_id}")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
    assert data["id"] == mock_incident_6_id
    assert data["type"] == mock_incident_6["type"]
    assert data["description"] == mock_incident_6["description"]
    assert data["created_at"] == mock_incident_6["created_at"]
    assert data["image_url"] == mock_incident_6["image_url"]
    assert data["membership_id"] == mock_incident_6["membership_id"]
    assert len(data["incident_states"]) == 1
    assert data["incident_states"][0]["id"] == mock_incident_state_6_1["id"]
    assert data["incident_states"][0]["status"] == mock_incident_state_6_1["status"]
    assert data["incident_states"][0]["created_at"] == mock_incident_state_6_1["created_at"]


def test_get_incident_multiple_states_correct():
    app.dependency_overrides[get_current_user] = lambda: mock_neighbor
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(
        extra={
            "incidents": [mock_incident_2],
            "incident_states": [mock_incident_state_2_1, mock_incident_state_2_2, mock_incident_state_2_3],
        }
    )
    response = client.get(f"/incidents/{mock_association_id}/{mock_incident_2_id}")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
    assert data["id"] == mock_incident_2_id
    assert len(data["incident_states"]) == 3
    # States should be ordered by created_at desc, so the latest state is first
    assert data["incident_states"][0]["id"] == mock_incident_state_2_3["id"]
    assert data["incident_states"][0]["status"] == mock_incident_state_2_3["status"]
    assert data["incident_states"][0]["created_at"] == mock_incident_state_2_3["created_at"]
    assert data["incident_states"][1]["id"] == mock_incident_state_2_2["id"]
    assert data["incident_states"][1]["status"] == mock_incident_state_2_2["status"]
    assert data["incident_states"][1]["created_at"] == mock_incident_state_2_2["created_at"]
    assert data["incident_states"][2]["id"] == mock_incident_state_2_1["id"]
    assert data["incident_states"][2]["status"] == mock_incident_state_2_1["status"]
    assert data["incident_states"][2]["created_at"] == mock_incident_state_2_1["created_at"]


def test_get_incident_not_found():
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.get(f"/incidents/{mock_association_id}/{str(uuid4())}")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"] == "Incident not found"


def test_get_incident_wrong_association():
    mock_incident_other_association_id = str(uuid4())
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.get(f"/incidents/{str(uuid4())}/{mock_incident_other_association_id}")
    assert response.status_code == 403
    data = response.json()
    assert data["detail"] == "Access denied to this community"


# ------------------- POST incidents/{association_id} ------------------


def test_post_incident_no_image_correct():
    app.dependency_overrides[get_current_user] = lambda: mock_neighbor
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    new_incident = {"type": "SAFETY", "description": "Broken gate in the parking lot"}
    response = client.post(f"/incidents/{mock_association_id}", data=new_incident)
    assert response.status_code == 201
    data = response.json()
    assert isinstance(data, dict)
    assert data["message"] == "Incident created successfully"
    assert "incident_id" in data
    assert "incident_state_id" in data
    assert data["image_url"] is None


def test_post_incident_with_image_correct():
    app.dependency_overrides[get_current_user] = lambda: mock_tenant
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    new_incident = {
        "type": "ELECTRICITY",
        "description": "Power outage in the building",
    }
    files = {"file": ("photo.png", b"fake image data", "image/png")}
    with patch("api.incidents.incidents.settings.CLOUDINARY_URL", "cloudinary://mock:url@mock"), patch(
        "api.incidents.incidents.cloudinary.uploader.upload",
        return_value={"secure_url": "https://example.com/photo.png"},
    ):
        response = client.post(f"/incidents/{mock_association_id}", data=new_incident, files=files)
    assert response.status_code == 201
    data = response.json()
    assert isinstance(data, dict)
    assert data["message"] == "Incident created successfully"
    assert "incident_id" in data
    assert "incident_state_id" in data
    assert data["image_url"] == "https://example.com/photo.png"


def test_post_incident_missing_description_correct():
    app.dependency_overrides[get_current_user] = lambda: mock_employee
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    new_incident = {"type": "SAFETY"}
    response = client.post(f"/incidents/{mock_association_id}", data=new_incident)
    assert response.status_code == 201
    data = response.json()
    assert isinstance(data, dict)
    assert data["message"] == "Incident created successfully"
    assert "incident_id" in data
    assert "incident_state_id" in data
    assert data["image_url"] is None


def test_post_incident_wrong_association():
    app.dependency_overrides[get_current_user] = lambda: mock_president
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    new_incident = {"type": "SAFETY", "description": "Broken gate in the parking lot"}
    response = client.post(f"/incidents/{mock_other_association_id}", data=new_incident)
    assert response.status_code == 403
    data = response.json()
    assert data["detail"] == "User has no access to this association"


def test_post_incident_admin():
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    new_incident = {"type": "SAFETY", "description": "Broken gate in the parking lot"}
    response = client.post(f"/incidents/{mock_association_id}", data=new_incident)
    assert response.status_code == 403
    data = response.json()
    assert data["detail"] == "Admins cannot create incidents"


def test_post_incident_invalid_type():
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    new_incident = {"type": "INVALID_TYPE", "description": "I don't know the types"}
    response = client.post(f"/incidents/{mock_association_id}", data=new_incident)
    assert response.status_code == 400
    data = response.json()
    assert data["detail"].startswith("Invalid incident type. Allowed values: {'")
    assert data["detail"].endswith("'}")


def test_post_incident_missing_type():
    app.dependency_overrides[get_current_user] = lambda: mock_employee
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    new_incident = {"description": "SAFETY"}
    response = client.post(f"/incidents/{mock_association_id}", data=new_incident)
    assert response.status_code == 422
    data = response.json()
    assert data["detail"][0]["loc"] == ["body", "type"]
    assert data["detail"][0]["msg"] == "Field required"
    assert data["detail"][0]["type"] == "missing"


def test_post_incident_cloudinary_exception():
    app.dependency_overrides[get_current_user] = lambda: mock_tenant
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    new_incident = {
        "type": "ELECTRICITY",
        "description": "Power outage in the building",
    }
    files = {"file": ("photo.png", b"fake image data", "image/png")}
    with patch("api.incidents.incidents.settings.CLOUDINARY_URL", "cloudinary://mock:url@mock"), patch(
        "api.incidents.incidents.cloudinary.uploader.upload", side_effect=Exception("Cloudinary upload failed")
    ):
        response = client.post(f"/incidents/{mock_association_id}", data=new_incident, files=files)
    assert response.status_code == 500
    data = response.json()
    assert data["detail"] == "Failed to upload image: Cloudinary upload failed"


def test_post_incident_cloudinary_config_missing():
    app.dependency_overrides[get_current_user] = lambda: mock_tenant
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    new_incident = {
        "type": "ELECTRICITY",
        "description": "Power outage in the building",
    }
    files = {"file": ("photo.png", b"fake image data", "image/png")}

    with patch("api.incidents.incidents.settings.CLOUDINARY_URL", ""), patch(
        "api.incidents.incidents.cloudinary.uploader.upload"
    ) as upload_mock:
        response = client.post(f"/incidents/{mock_association_id}", data=new_incident, files=files)

    assert response.status_code == 500
    data = response.json()
    assert data["detail"] == "Failed to upload image: 500: Cloudinary configuration is missing"
    upload_mock.assert_not_called()


def test_post_incident_create_in_db_fails():
    app.dependency_overrides[get_current_user] = lambda: mock_tenant

    supabase_mock = MagicMock()

    memberships_table = MagicMock()
    memberships_table.select.return_value = memberships_table
    memberships_table.eq.return_value = memberships_table
    memberships_table.execute.return_value = MagicMock(data=[{"id": mock_tenant_membership_id, "role": "3"}])

    incidents_table = MagicMock()
    incidents_table.insert.return_value = incidents_table
    incidents_table.execute.return_value = MagicMock(data=[])

    incident_states_table = MagicMock()
    incident_states_table.insert.return_value = incident_states_table
    incident_states_table.execute.return_value = MagicMock(data=[{"id": 999}])

    def table_side_effect(name: str):
        if name == "memberships":
            return memberships_table
        if name == "incidents":
            return incidents_table
        if name == "incident_states":
            return incident_states_table
        return MagicMock()

    supabase_mock.table.side_effect = table_side_effect
    app.dependency_overrides[get_supabase] = lambda: supabase_mock

    new_incident = {
        "type": "SAFETY",
        "description": "Broken gate in the parking lot",
    }

    response = client.post(f"/incidents/{mock_association_id}", data=new_incident)
    assert response.status_code == 500
    data = response.json()
    assert data["detail"] == "Failed to create incident in database"
    incident_states_table.insert.assert_not_called()


# ------------------- POST incidents/{association_id}/{incident_id}/status ------------------


@pytest.mark.parametrize(
    "user,incident_id,new_status,expected_old_status,expected_new_status",
    [
        (mock_admin, mock_incident_3_id, "IN PROGRESS", "PENDING", "IN PROGRESS"),
        (mock_president, mock_incident_8_id, "SOLVED", "IN PROGRESS", "SOLVED"),
        (mock_employee, mock_incident_4_id, "DISCARDED", "PENDING", "DISCARDED"),
        (mock_admin, mock_incident_5_id, "SOLVED", "PENDING", "SOLVED"),
        (mock_president, mock_incident_8_id, "PENDING", "IN PROGRESS", "PENDING"),
    ],
)
def test_post_state_status_correct(
    user,
    incident_id,
    new_status,
    expected_old_status,
    expected_new_status,
):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.post(f"/incidents/{mock_association_id}/{incident_id}/status?status={new_status}")
    assert response.status_code == 201
    data = response.json()
    assert isinstance(data, dict)
    assert data["message"] == "Incident status updated successfully"
    assert data["incident_id"] == incident_id
    assert data["old_status"] == expected_old_status
    assert data["new_status"] == expected_new_status


@pytest.mark.parametrize(
    "incident_id",
    [
        mock_incident_2_id,  # Already SOLVED
        mock_incident_1_id,  # DISCARDED
    ],
)
def test_post_state_deadend_states(incident_id):
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.post(f"/incidents/{mock_association_id}/{incident_id}/status?status=IN%20PROGRESS")
    assert response.status_code == 409
    data = response.json()
    assert data["detail"] == "Cannot update status of a resolved or discarded incident"


@pytest.mark.parametrize(
    "incident_id,status",
    [
        (mock_incident_3_id, "PENDING"),
        (mock_incident_8_id, "IN PROGRESS"),
    ],
)
def test_post_state_same_status(incident_id, status):
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.post(f"/incidents/{mock_association_id}/{incident_id}/status?status={status}")
    assert response.status_code == 400
    data = response.json()
    assert data["detail"] == f"Incident is already in {status} status"


def test_post_state_invalid_status():
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.post(f"/incidents/{mock_association_id}/{mock_incident_3_id}/status?status=INVALID")
    assert response.status_code == 400
    data = response.json()
    assert data["detail"].startswith("Invalid status. Allowed values: {'")
    assert data["detail"].endswith("'}")


def test_post_state_wrong_role():
    app.dependency_overrides[get_current_user] = lambda: mock_tenant
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.post(f"/incidents/{mock_association_id}/{mock_incident_3_id}/status?status=IN PROGRESS")
    assert response.status_code == 403
    data = response.json()
    assert data["detail"] == "Admin, president or employee access required for this action"


def test_post_state_wrong_association():
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.post(f"/incidents/{mock_other_association_id}/{mock_incident_3_id}/status?status=IN PROGRESS")
    assert response.status_code == 403
    data = response.json()
    assert data["detail"] == "User has no access to this association"


def test_post_state_incident_not_found():
    app.dependency_overrides[get_current_user] = lambda: mock_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.post(f"/incidents/{mock_association_id}/{str(uuid4())}/status?status=IN PROGRESS")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"] == "Incident not found"


@pytest.mark.parametrize(
    "user,incident_id",
    [
        (mock_president, mock_incident_7_id),
        (mock_employee, mock_incident_5_id),
    ],
)
def test_post_state_own_incident(user, incident_id):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.post(f"/incidents/{mock_association_id}/{incident_id}/status?status=IN PROGRESS")
    assert response.status_code == 403
    data = response.json()
    assert data["detail"] == "Users cannot update the status of their own incidents"


# ------------------- DELETE incidents/{association_id}/{incident_id} ------------------


@pytest.mark.parametrize(
    "user,incident_id",
    [
        (mock_neighbor, mock_incident_1_id),
        (mock_tenant, mock_incident_2_id),
    ],
)
def test_delete_incident_correct(user, incident_id):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.delete(f"/incidents/{mock_association_id}/{incident_id}")
    assert response.status_code == 204
    assert response.content == b""


def test_delete_incident_not_incident_owner():
    app.dependency_overrides[get_current_user] = lambda: mock_employee
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.delete(f"/incidents/{mock_association_id}/{mock_incident_1_id}")
    assert response.status_code == 403
    data = response.json()
    assert data["detail"] == "User does not own this incident"


def test_delete_incident_wrong_association():
    app.dependency_overrides[get_current_user] = lambda: mock_neighbor
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.delete(f"/incidents/{mock_other_association_id}/{mock_incident_1_id}")
    assert response.status_code == 404
    data = response.json()
    assert data["detail"] == "Membership not found in this association"


@pytest.mark.parametrize(
    "incident_id",
    [
        mock_incident_6_id,
        mock_incident_8_id,
    ],
)
def test_delete_incident_not_reviewed(incident_id):
    app.dependency_overrides[get_current_user] = lambda: mock_tenant
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    response = client.delete(f"/incidents/{mock_association_id}/{incident_id}")
    assert response.status_code == 409
    data = response.json()
    assert data["detail"] == "Incident hasn't been reviewed"
