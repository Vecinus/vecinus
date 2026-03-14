import os
from unittest.mock import MagicMock, patch
from uuid import uuid4

from fastapi.testclient import TestClient

# Set dummy env vars for pydantic settings before importing app
os.environ["SUPABASE_URL"] = "http://localhost:8000"
os.environ["SUPABASE_KEY"] = "dummy"
os.environ["SUPABASE_SERVICE_KEY"] = "dummy-service"

from core.deps import (  # noqa: E402
    get_current_user,
    get_supabase,
    get_supabase_admin,
    get_supabase_anon,
)
from main import app  # noqa: E402

client = TestClient(app)

# Mocked IDs
mock_user_id = str(uuid4())
mock_user_email = "admin@test.com"
mock_association_id = str(uuid4())
mock_property_id = str(uuid4())
mock_membership_id = str(uuid4())
mock_invitation_id = str(uuid4())
mock_target_user_id = str(uuid4())
mock_membership2_id = str(uuid4())

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
    return MockSupabaseClient(base, rls_blocked=rls_blocked)


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
        # The mock filters by profile_id = mock_user_id, so only 1 matches
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
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase()
    try:
        with patch("api.associations.associations.send_invitation_email"):
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
    # RLS blocks INSERT on invitations because non_owner is not ADMIN
    blocked_mock = make_mock_supabase(rls_blocked={"invitations": {"insert"}})
    app.dependency_overrides[get_supabase] = lambda: blocked_mock
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
    app.dependency_overrides[get_supabase_admin] = lambda: make_owner_supabase()
    try:
        with patch("api.associations.associations.send_invitation_email"):
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
    # RLS blocks INSERT on invitations: non_owner is not OWNER of this property
    blocked_mock = MockSupabaseClient(
        {"memberships": [], "invitations": []},
        rls_blocked={"invitations": {"insert"}},
    )
    app.dependency_overrides[get_supabase] = lambda: blocked_mock
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

    mock_session = MagicMock()
    mock_session.access_token = "fake-jwt-token"

    mock_new_user = MagicMock()
    mock_new_user.id = new_user_id

    mock_auth_response = MagicMock()
    mock_auth_response.user = mock_new_user
    mock_auth_response.session = mock_session

    anon_mock = make_mock_supabase()
    anon_mock.auth = MagicMock()
    anon_mock.auth.sign_up = MagicMock(return_value=mock_auth_response)

    # Mock the user-scoped client created inside the endpoint after sign_up
    user_client_mock = make_mock_supabase()
    user_client_mock.postgrest = MagicMock()

    app.dependency_overrides[get_supabase_anon] = lambda: anon_mock
    with patch(
        "api.associations.associations.create_client",
        return_value=user_client_mock,
    ):
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
            anon_mock.auth.sign_up.assert_called_once_with({"email": "invited@test.com", "password": "SecurePass123!"})
        finally:
            app.dependency_overrides.clear()


def test_accept_invitation_not_found():
    anon_mock = MockSupabaseClient(
        {
            "invitations": [],  # no PENDING invitation with this token
            "profiles": [],
            "memberships": [],
        }
    )
    anon_mock.auth = MagicMock()

    app.dependency_overrides[get_supabase_anon] = lambda: anon_mock
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


# ──────────────────────────────────────────────────────────────────────────────
# Test: DELETE /members/{membership_id}
# ──────────────────────────────────────────────────────────────────────────────


def test_remove_member_success():
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase()

    try:
        response = client.delete(f"/members/{mock_membership_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == f"Membership {mock_membership_id} deleted successfully"
    finally:
        app.dependency_overrides.clear()


def test_remove_member_not_admin_fails():
    app.dependency_overrides[get_current_user] = lambda: mock_non_owner
    # RLS blocks DELETE on memberships because non_owner is not ADMIN
    blocked_mock = make_mock_supabase(rls_blocked={"memberships": {"delete"}})
    app.dependency_overrides[get_supabase] = lambda: blocked_mock
    try:
        response = client.delete(f"/members/{mock_membership_id}")
        assert response.status_code == 403
        assert response.json()["detail"] == "Admin access required for this action"
    finally:
        app.dependency_overrides.clear()


def test_remove_member_different_association_fails():
    # With RLS, user cannot see memberships of other associations.
    # SELECT returns empty → 404 before even attempting DELETE.
    app.dependency_overrides[get_current_user] = lambda: mock_user
    # Empty memberships: RLS hides mock_membership2_id (different association)
    hidden_mock = make_mock_supabase(extra={"memberships": []})
    app.dependency_overrides[get_supabase] = lambda: hidden_mock
    try:
        response = client.delete(f"/members/{mock_membership2_id}")
        assert response.status_code == 404
        assert response.json()["detail"] == "Membership not found"
    finally:
        app.dependency_overrides.clear()


def test_remove_member_not_found():
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    wrong_membership_id = "33"
    try:
        response = client.delete(f"/members/{wrong_membership_id}")
        assert response.status_code == 404
        assert response.json()["detail"] == "Membership not found"
    finally:
        app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────────────────────
# Test: POST /{association_id}/properties
# ──────────────────────────────────────────────────────────────────────────────


def test_create_property_success():
    """Admin (role=1) crea una nueva propiedad exitosamente."""
    mock_supabase = make_mock_supabase(extra={"properties": []})
    mock_admin = make_mock_supabase(extra={"properties": []})

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    app.dependency_overrides[get_supabase_admin] = lambda: mock_admin
    try:
        response = client.post(
            f"/{mock_association_id}/properties",
            json={"number": "101"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["number"] == "101"
        assert data["association_id"] == mock_association_id
    finally:
        app.dependency_overrides.clear()


def test_create_property_president_success():
    """Presidente (role=4) puede crear una propiedad."""
    president_mock = MockSupabaseClient(
        {
            "memberships": [
                {
                    "id": mock_membership_id,
                    "association_id": mock_association_id,
                    "profile_id": mock_user_id,
                    "role": 4,  # PRESIDENT
                    "property_id": None,
                }
            ],
            "properties": [],
        }
    )
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: president_mock
    app.dependency_overrides[get_supabase_admin] = lambda: president_mock
    try:
        response = client.post(
            f"/{mock_association_id}/properties",
            json={"number": "202"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["number"] == "202"
    finally:
        app.dependency_overrides.clear()


def test_create_property_non_admin_fails():
    """Usuario sin rol admin/presidente (role=3, TENANT) recibe 403."""
    app.dependency_overrides[get_current_user] = lambda: mock_non_owner
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase()
    try:
        response = client.post(
            f"/{mock_association_id}/properties",
            json={"number": "303"},
        )
        assert response.status_code == 403
        assert response.json()["detail"] == "Acceso denegado. Se requiere ser Administrador o Presidente."
    finally:
        app.dependency_overrides.clear()


def test_create_property_already_exists():
    """Devuelve 400 si ya existe una propiedad con ese número en la comunidad."""
    existing_property = {
        "id": str(uuid4()),
        "association_id": mock_association_id,
        "number": "101",
    }
    mock_supabase = make_mock_supabase(extra={"properties": [existing_property]})

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: mock_supabase
    try:
        response = client.post(
            f"/{mock_association_id}/properties",
            json={"number": "101"},
        )
        assert response.status_code == 400
        assert response.json()["detail"] == "Esta propiedad ya existe en la comunidad."
    finally:
        app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────────────────────
# [INTEGRACIÓN] Test manual — solo para uso interno, no se ejecuta en CI.
# Requiere backend corriendo en localhost:8000 y .env configurado.
# Para lanzar: descomenta la función y ejecuta:
#   pytest tests/associationsTest/test_associations.py::test_invite_admin_real_email_and_cleanup -v
# ──────────────────────────────────────────────────────────────────────────────

# def test_invite_admin_real_email_and_cleanup():
#     import requests
#     from supabase import create_client, ClientOptions
#
#     BACKEND_URL = "http://localhost:8000"
#     ADMIN_EMAIL = "prueba2@prueba.com"
#     ADMIN = "prueba2"
#     TARGET_EMAIL = "vecinusispp@gmail.com"
#     ASSOCIATION_ID = "6aa60a59-0135-4747-870d-c65e79326e13"
#
#     # 1. Login como admin
#     login_res = requests.post(
#         f"{BACKEND_URL}/login",
#         json={"email": ADMIN_EMAIL, "password": ADMIN},
#     )
#     assert login_res.status_code == 200, f"Login failed: {login_res.text}"
#     token = login_res.json()["session"]["access_token"]
#
#     # 2. Enviar invitación como Presidente (role=4)
#     invite_res = requests.post(
#         f"{BACKEND_URL}/invite/admin",
#         headers={"Authorization": f"Bearer {token}"},
#         json={
#             "target_email": TARGET_EMAIL,
#             "association_id": ASSOCIATION_ID,
#             "role_to_grant": 4,
#         },
#     )
#     assert invite_res.status_code == 200, f"Invite failed: {invite_res.text}"
#     invitation = invite_res.json()
#     assert invitation["target_email"] == TARGET_EMAIL
#     assert invitation["role_to_grant"] == 4
#     assert invitation["status"] == 1
#     invitation_id = invitation["id"]
#
#     # 3. Cleanup: borrar invitación de la BD con cliente admin
#     # Leemos el .env real porque este fichero sobreescribe las vars con dummies al importar
#     from pathlib import Path
#     from dotenv import dotenv_values
#     env = dotenv_values(Path(__file__).resolve().parents[2] / ".env")
#     admin_client = create_client(
#         env["SUPABASE_URL"],
#         env["SUPABASE_SERVICE_KEY"],
#         options=ClientOptions(schema=env.get("SUPABASE_SCHEMA", "dev")),
#     )
#     delete_res = admin_client.table("invitations").delete().eq("id", invitation_id).execute()
#     assert delete_res.data is not None
#
#     # 4. Verificar que ya no existe
#     check_res = admin_client.table("invitations").select("id").eq("id", invitation_id).execute()
#     assert check_res.data == [], "La invitación no se borró correctamente"
