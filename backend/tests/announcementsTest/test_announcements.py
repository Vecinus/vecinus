import os
from unittest.mock import patch
from uuid import uuid4

from core.deps import get_current_user, get_supabase, get_supabase_admin
from fastapi.testclient import TestClient
from main import app

# Set dummy env vars for pydantic settings before importing app
os.environ["SUPABASE_URL"] = "http://localhost:8000"
os.environ["SUPABASE_KEY"] = "dummy"
os.environ["SUPABASE_SERVICE_KEY"] = "dummy-service"

client = TestClient(app)

mock_user_id = str(uuid4())
mock_association_id = str(uuid4())
mock_announcement_id = str(uuid4())
mock_membership_id = str(uuid4())

mock_user = {
    "id": mock_user_id,
    "role": "authenticated",
    "email": "test@test.com",
}

mock_non_admin_id = str(uuid4())
mock_non_admin = {
    "id": mock_non_admin_id,
    "role": "authenticated",
    "email": "tenant@test.com",
}


class MockSupabaseTable:
    def __init__(self, table_name, data, rls_blocked_ops=None):
        self.table_name = table_name
        self._all_data = data
        self._data = list(data)
        self._operation = "select"
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
            if "created_at" not in new_item:
                new_item["created_at"] = "2023-01-01T00:00:00Z"
            if "updated_at" not in new_item:
                new_item["updated_at"] = "2023-01-01T00:00:00Z"
            self._inserted.append(new_item)
        return self

    def eq(self, column, value, **kwargs):
        self._data = [item for item in self._data if str(item.get(column)) == str(value)]
        return self

    def order(self, column, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def update(self, data, *args, **kwargs):
        self._operation = "update"
        self._updated = []
        for item in self._data:
            updated = item.copy()
            updated.update(data)
            if "created_at" not in updated:
                updated["created_at"] = "2023-01-01T00:00:00Z"
            if "updated_at" not in updated:
                updated["updated_at"] = "2023-01-01T00:00:00Z"
            self._updated.append(updated)
        if not self._updated:
            new_item = {"id": "dummy", **data}
            if "created_at" not in new_item:
                new_item["created_at"] = "2023-01-01T00:00:00Z"
            if "updated_at" not in new_item:
                new_item["updated_at"] = "2023-01-01T00:00:00Z"
            self._updated = [new_item]
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
        self.rls_blocked = rls_blocked or {}

    def table(self, name: str):
        table = MockSupabaseTable(
            name,
            self.mock_responses.get(name, []),
            rls_blocked_ops=self.rls_blocked.get(name, set()),
        )
        return table


def make_mock_supabase(extra=None, rls_blocked=None, role=1):
    base = {
        "community_subscriptions": [{"association_id": mock_association_id, "status": "active"}],
        "memberships": [
            {
                "id": mock_membership_id,
                "association_id": mock_association_id,
                "profile_id": mock_user_id,
                "role": role,
            },
            {
                "id": str(uuid4()),
                "association_id": mock_association_id,
                "profile_id": mock_non_admin_id,
                "role": 3,
            },
        ],
        "announcements": [
            {
                "id": mock_announcement_id,
                "association_id": mock_association_id,
                "title": "Test Title",
                "content": "Test Content",
                "status": "PUBLISHED",
                "created_by": mock_membership_id,
                "created_at": "2023-01-01T00:00:00Z",
                "updated_at": "2023-01-01T00:00:00Z",
                "image_url": None,
                "scheduled_date": None,
            },
            {
                "id": str(uuid4()),
                "association_id": mock_association_id,
                "title": "Draft Title",
                "content": "Draft Content",
                "status": "DRAFT",
                "created_by": mock_membership_id,
                "created_at": "2023-01-01T00:00:00Z",
                "updated_at": "2023-01-01T00:00:00Z",
                "image_url": None,
                "scheduled_date": None,
            },
        ],
    }
    if extra:
        for k, v in extra.items():
            base[k] = v
    return MockSupabaseClient(base, rls_blocked=rls_blocked)


# ──────────────────────────────────────────────────────────────────────────────
# Test: GET /announcements/{association_id}
# ──────────────────────────────────────────────────────────────────────────────


def test_get_announcements_admin():
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(role=1)

    try:
        response = client.get(f"/announcements/{mock_association_id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2  # Sees both published and draft
    finally:
        app.dependency_overrides.clear()


def test_get_announcements_tenant():
    app.dependency_overrides[get_current_user] = lambda: mock_non_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(role=1)

    try:
        response = client.get(f"/announcements/{mock_association_id}")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1  # Sees only published
        assert data[0]["status"] == "PUBLISHED"
    finally:
        app.dependency_overrides.clear()


def test_get_announcements_without_subscription_returns_402():
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(extra={"community_subscriptions": []}, role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(
        extra={"community_subscriptions": []}, role=1
    )

    try:
        response = client.get(f"/announcements/{mock_association_id}")
        assert response.status_code == 402
        assert response.json()["detail"]["code"] == "community_no_subscription"
    finally:
        app.dependency_overrides.clear()


def test_get_announcements_with_blocked_subscription_returns_402():
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(
        extra={"community_subscriptions": [{"association_id": mock_association_id, "status": "past_due"}]}, role=1
    )
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(
        extra={"community_subscriptions": [{"association_id": mock_association_id, "status": "past_due"}]}, role=1
    )

    try:
        response = client.get(f"/announcements/{mock_association_id}")
        assert response.status_code == 402
        assert response.json()["detail"]["code"] == "community_blocked"
    finally:
        app.dependency_overrides.clear()


def test_get_announcements_draft_as_tenant():
    app.dependency_overrides[get_current_user] = lambda: mock_non_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(role=1)

    try:
        response = client.get(f"/announcements/{mock_association_id}?status=DRAFT")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────────────────────
# Test: GET /announcements/{association_id}/{announcement_id}
# ──────────────────────────────────────────────────────────────────────────────


def test_get_announcement_success():
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(role=1)

    try:
        response = client.get(f"/announcements/{mock_association_id}/{mock_announcement_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Test Title"
    finally:
        app.dependency_overrides.clear()


def test_get_announcement_not_found():
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(role=1)

    try:
        response = client.get(f"/announcements/{mock_association_id}/fake_id")
        assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────────────────────
# Test: POST /announcements/{association_id}
# ──────────────────────────────────────────────────────────────────────────────


@patch("api.announcements.announcements.cloudinary.uploader.upload")
def test_create_announcement_success(mock_upload):
    mock_upload.return_value = {"secure_url": "https://fake.url/img.png"}

    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(role=1)

    try:
        response = client.post(
            f"/announcements/{mock_association_id}",
            data={"title": "New Title", "content": "New Content", "status": "PUBLISHED"},
        )
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "New Title"
    finally:
        app.dependency_overrides.clear()


def test_create_announcement_tenant_fails():
    app.dependency_overrides[get_current_user] = lambda: mock_non_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(role=1)

    try:
        response = client.post(
            f"/announcements/{mock_association_id}",
            data={"title": "New Title", "content": "New Content", "status": "PUBLISHED"},
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_create_announcement_without_subscription_returns_402():
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(extra={"community_subscriptions": []}, role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(
        extra={"community_subscriptions": []}, role=1
    )

    try:
        response = client.post(
            f"/announcements/{mock_association_id}",
            data={"title": "New Title", "content": "New Content", "status": "PUBLISHED"},
        )
        assert response.status_code == 402
        assert response.json()["detail"]["code"] == "community_no_subscription"
    finally:
        app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────────────────────
# Test: PUT /announcements/{association_id}/{announcement_id}
# ──────────────────────────────────────────────────────────────────────────────


@patch("api.announcements.announcements.settings.CLOUDINARY_URL", "cloudinary://key:secret@cloud")
@patch("api.announcements.announcements.cloudinary.uploader.upload")
def test_create_announcement_rejects_non_image_upload(mock_upload):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(role=1)

    try:
        response = client.post(
            f"/announcements/{mock_association_id}",
            data={"title": "New Title", "content": "New Content", "status": "PUBLISHED"},
            files={"file": ("payload.txt", b"not an image", "text/plain")},
        )
        assert response.status_code == 415
        mock_upload.assert_not_called()
    finally:
        app.dependency_overrides.clear()


def test_update_announcement_success():
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(role=1)

    try:
        response = client.put(
            f"/announcements/{mock_association_id}/{mock_announcement_id}",
            data={
                "title": "Updated Title",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
    finally:
        app.dependency_overrides.clear()


def test_update_announcement_tenant_fails():
    app.dependency_overrides[get_current_user] = lambda: mock_non_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(role=1)

    try:
        response = client.put(
            f"/announcements/{mock_association_id}/{mock_announcement_id}",
            data={
                "title": "Updated Title",
            },
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


# ──────────────────────────────────────────────────────────────────────────────
# Test: DELETE /announcements/{association_id}/{announcement_id}
# ──────────────────────────────────────────────────────────────────────────────


@patch("api.announcements.announcements.settings.CLOUDINARY_URL", "cloudinary://key:secret@cloud")
@patch("api.announcements.announcements.cloudinary.uploader.upload")
def test_update_announcement_rejects_non_image_upload(mock_upload):
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(role=1)

    try:
        response = client.put(
            f"/announcements/{mock_association_id}/{mock_announcement_id}",
            data={"title": "Updated Title"},
            files={"file": ("payload.txt", b"not an image", "text/plain")},
        )
        assert response.status_code == 415
        mock_upload.assert_not_called()
    finally:
        app.dependency_overrides.clear()


def test_delete_announcement_success():
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(role=1)

    try:
        response = client.delete(f"/announcements/{mock_association_id}/{mock_announcement_id}")
        assert response.status_code == 204
    finally:
        app.dependency_overrides.clear()


def test_delete_announcement_tenant_fails():
    app.dependency_overrides[get_current_user] = lambda: mock_non_admin
    app.dependency_overrides[get_supabase] = lambda: make_mock_supabase(role=1)
    app.dependency_overrides[get_supabase_admin] = lambda: make_mock_supabase(role=1)

    try:
        response = client.delete(f"/announcements/{mock_association_id}/{mock_announcement_id}")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
