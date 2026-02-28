import os
from unittest.mock import MagicMock
from uuid import uuid4

from fastapi.testclient import TestClient

# Set dummy env vars for pydantic settings before importing app
os.environ["SUPABASE_URL"] = "http://localhost:8000"
os.environ["SUPABASE_KEY"] = "dummy"
os.environ["SUPABASE_SERVICE_KEY"] = "dummy-service"

from core.deps import get_current_user, get_supabase, get_supabase_admin
from main import app

client = TestClient(app)

# Mocked IDs
mock_user_id = str(uuid4())
mock_user_email = "admin@test.com"
mock_association_id = str(uuid4())
mock_property_id = str(uuid4())
mock_membership_id = str(uuid4())
mock_invitation_id = str(uuid4())
mock_target_user_id = str(uuid4())

mock_user = {
    "id": mock_user_id,
    "role": "authenticated",
    "email": mock_user_email,
}

mock_non_owner_id = str(uuid4())
mock_non_owner = {
    "id": mock_non_owner_id,
    "role": "authenticated",
    "email": "nonowner@test.com",
}


class MockSupabaseTable:
    def __init__(self, table_name, data):
        self.table_name = table_name
        self._all_data = data
        self._data = list(data)
        self._operation = "select"

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
        self._data = [
            item for item in self._data if str(item.get(column)) == str(value)
        ]
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

    def execute(self):
        class MockResponse:
            def __init__(self, data):
                self.data = data

        if self._operation == "insert":
            return MockResponse(self._inserted)
        if self._operation == "update":
            return MockResponse(self._updated)
        return MockResponse(self._data)


class MockSupabaseClient:
    def __init__(self, mock_responses):
        self.mock_responses = mock_responses

    def table(self, name: str):
        return MockSupabaseTable(name, self.mock_responses.get(name, []))


def make_mock_supabase(extra=None):
    base = {
        "memberships": [
            {
                "id": mock_membership_id,
                "association_id": mock_association_id,
                "profile_id": mock_user_id,
                "role": 1,  # ADMIN
                "property_id": None,
                "joined_at": "2026-02-22T00:00:00Z",
                "neighborhood_associations": {
                    "id": mock_association_id,
                    "name": "Comunidad Test",
                    "address": "Calle Mayor 1",
                },
            },
            {
                "id": str(uuid4()),
                "association_id": mock_association_id,
                "profile_id": mock_non_owner_id,
                "role": 3,  # TENANT
                "property_id": mock_property_id,
                "joined_at": "2026-02-22T00:00:00Z",
            },
        ],
        "invitations": [
            {
                "id": mock_invitation_id,
                "target_email": "invited@test.com",
                "association_id": mock_association_id,
                "property_id": None,
                "role_to_grant": 2,
                "invited_by_profile_id": mock_user_id,
                "status": 1,  # PENDING
            }
        ],
        "profiles": [],
    }
    if extra:
        for k, v in extra.items():
            base[k] = v
    return MockSupabaseClient(base)


def make_owner_supabase():
    """Supabase mock where mock_user is OWNER of mock_property_id."""
    return MockSupabaseClient(
        {
            "memberships": [
                {
                    "id": mock_membership_id,
                    "association_id": mock_association_id,
                    "profile_id": mock_user_id,
                    "role": 2,  # OWNER
                    "property_id": mock_property_id,
                    "joined_at": "2026-02-22T00:00:00Z",
                    "neighborhood_associations": {
                        "id": mock_association_id,
                        "name": "Comunidad Test",
                        "address": "Calle Mayor 1",
                    },
                }
            ],
            "invitations": [],
            "profiles": [],
        }
    )


# ──────────────────────────────────────────────────────────────────────────────
# Test: GET /users/me/communities
# ──────────────────────────────────────────────────────────────────────────────


def test_get_my_communities():
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    try:
        response = client.get("/users/me/communities")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # The mock filters by profile_id = mock_user_id, so only 1 membership matches
        assert len(data) == 1
        assert data[0]["association_id"] == mock_association_id
        assert data[0]["role"] == 1
        assert data[0]["neighborhood_associations"]["name"] == "Comunidad Test"
    finally:
        app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────────────────────
# Test: POST /invite/admin
# ──────────────────────────────────────────────────────────────────────────────


def test_invite_admin_success():
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    try:
        response = client.post(
            "/invite/admin",
            json={
                "association_id": mock_association_id,
                "target_email": "newmember@test.com",
                "role_to_grant": 4,  # PRESIDENT
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["target_email"] == "newmember@test.com"
        assert data["role_to_grant"] == 4
        assert data["status"] == 1
    finally:
        app.dependency_overrides.clear()


def test_invite_admin_cannot_grant_admin_role():
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    try:
        response = client.post(
            "/invite/admin",
            json={
                "association_id": mock_association_id,
                "target_email": "newadmin@test.com",
                "role_to_grant": 1,  # ADMIN — forbidden
            },
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Cannot grant ADMIN role via invitation"
    finally:
        app.dependency_overrides.clear()


def test_invite_admin_non_admin_fails():
    app.dependency_overrides[get_current_user] = lambda: mock_non_owner
    # Supabase where mock_non_owner has role=3 (TENANT), not admin
    non_admin_supabase = MockSupabaseClient(
        {
            "memberships": [
                {
                    "id": str(uuid4()),
                    "association_id": mock_association_id,
                    "profile_id": mock_non_owner_id,
                    "role": 3,  # TENANT, not ADMIN
                    "property_id": mock_property_id,
                    "joined_at": "2026-02-22T00:00:00Z",
                }
            ],
            "invitations": [],
        }
    )
    app.dependency_overrides[get_supabase] = lambda: non_admin_supabase
    try:
        response = client.post(
            "/invite/admin",
            json={
                "association_id": mock_association_id,
                "target_email": "someone@test.com",
                "role_to_grant": 2,
            },
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────────────────────
# Test: POST /invite/tenant
# ──────────────────────────────────────────────────────────────────────────────


def test_invite_tenant_success():
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_owner_supabase()
    try:
        response = client.post(
            "/invite/tenant",
            json={
                "association_id": mock_association_id,
                "property_id": mock_property_id,
                "target_email": "tenant@test.com",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["target_email"] == "tenant@test.com"
        assert data["role_to_grant"] == 3  # TENANT
        assert data["status"] == 1
    finally:
        app.dependency_overrides.clear()


def test_invite_tenant_not_owner_fails():
    app.dependency_overrides[get_current_user] = lambda: mock_non_owner
    non_owner_supabase = MockSupabaseClient(
        {
            "memberships": [],  # no ownership record
            "invitations": [],
        }
    )
    app.dependency_overrides[get_supabase] = lambda: non_owner_supabase
    try:
        response = client.post(
            "/invite/tenant",
            json={
                "association_id": mock_association_id,
                "property_id": mock_property_id,
                "target_email": "tenant@test.com",
            },
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────────────────────
# Test: POST /auth/accept-invitation
# ──────────────────────────────────────────────────────────────────────────────


def test_accept_invitation_success():
    new_user_id = str(uuid4())

    mock_new_user = MagicMock()
    mock_new_user.id = new_user_id

    mock_auth_response = MagicMock()
    mock_auth_response.user = mock_new_user

    admin_mock = make_mock_supabase()
    admin_mock.auth = MagicMock()
    admin_mock.auth.admin = MagicMock()
    admin_mock.auth.admin.create_user = MagicMock(return_value=mock_auth_response)

    app.dependency_overrides[get_supabase_admin] = lambda: admin_mock
    try:
        response = client.post(
            "/auth/accept-invitation",
            json={
                "invitation_token": mock_invitation_id,
                "password": "SecurePass123!",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Invitation accepted"
        assert data["user_id"] == new_user_id
        admin_mock.auth.admin.create_user.assert_called_once()
    finally:
        app.dependency_overrides.clear()


def test_accept_invitation_not_found():
    admin_mock = MockSupabaseClient(
        {
            "invitations": [],  # no PENDING invitation with this token
            "profiles": [],
            "memberships": [],
        }
    )
    admin_mock.auth = MagicMock()

    app.dependency_overrides[get_supabase_admin] = lambda: admin_mock
    try:
        response = client.post(
            "/auth/accept-invitation",
            json={
                "invitation_token": str(uuid4()),  # random token, won't match
                "password": "SomePass123!",
            },
        )
        assert response.status_code == 404
        assert response.json()["detail"] == "Invitation not found or already used"
    finally:
        app.dependency_overrides.clear()
