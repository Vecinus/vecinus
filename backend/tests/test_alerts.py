from fastapi.testclient import TestClient
from uuid import uuid4
from main import app
from core.deps import get_current_user, get_supabase

client = TestClient(app)

mock_user = {
    "id": str(uuid4()),
    "username": "testuser_alerts",
}

mock_alert_id = str(uuid4())

class MockSupabaseTableAlerts:
    def __init__(self, table_name, data):
        self.table_name = table_name
        self._data = data

    def select(self, *args, **kwargs):
        self._operation = "select"
        return self

    def update(self, payload, *args, **kwargs):
        self._operation = "update"
        self._payload = payload
        return self

    def eq(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def execute(self):
        class MockResponse:
            def __init__(self, data):
                self.data = data
        
        if self._operation == "update":
            # Just create a fake updated alert object
            updated_alert = {**self._data[0], **self._payload} if self._data else {}
            return MockResponse([updated_alert])
        return MockResponse(self._data)

class MockSupabaseClientAlerts:
    def table(self, name: str):
        if name == "alerts":
            data = [{
                "id": mock_alert_id,
                "user_id": mock_user["id"],
                "title": "Aviso comunidad",
                "content": "Agua cortada",
                "is_read": False,
                "created_at": "2026-02-22T00:00:00Z"
            }]
            return MockSupabaseTableAlerts(name, data)
        return MockSupabaseTableAlerts(name, [])

def override_get_current_user():
    return mock_user

def override_get_supabase():
    return MockSupabaseClientAlerts()

import pytest
@pytest.fixture(autouse=True)
def setup_overrides():
    app.dependency_overrides[get_current_user] = override_get_current_user
    app.dependency_overrides[get_supabase] = override_get_supabase
    yield
    app.dependency_overrides.clear()

def test_get_alerts():
    response = client.get("/alerts")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["title"] == "Aviso comunidad"

def test_mark_alert_read():
    response = client.put(f"/alerts/{mock_alert_id}/read")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == mock_alert_id
    assert data["is_read"] is True
