from unittest.mock import AsyncMock, MagicMock, patch

import api.transcription.minutes as minutes_api
import pytest
from api.transcription.minutes import get_service
from core.deps import get_current_user, get_supabase, get_supabase_admin, require_active_community
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from main import app
from schemas.transcription.minutes import AIGeneratedContent
from services.transcription.transcription_service import TranscriptionService

MOCK_USER = {"id": "user-1", "role": "authenticated", "email": "test@test.com"}
ASSOCIATION_ID = "11111111-1111-1111-1111-111111111111"


class _MockResponse:
    def __init__(self, data):
        self.data = data


class _MockSupabaseTable:
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
        return _MockResponse(self._rows)


class _MockSupabaseAdmin:
    def __init__(self):
        self._community_subscriptions = [{"association_id": "11111111-1111-1111-1111-111111111111", "status": "active"}]

    def table(self, name: str):
        if name == "community_subscriptions":
            return _MockSupabaseTable(self._community_subscriptions)
        return _MockSupabaseTable([])


@pytest.mark.anyio
class TestMinutesAPI:
    async def test_transcribe_success(self):
        app.dependency_overrides[get_current_user] = lambda: {
            "id": "11111111-1111-1111-1111-111111111110",
            "role": "authenticated",
            "email": "admin@test.com",
        }
        app.dependency_overrides[get_supabase_admin] = lambda: _MockSupabaseAdmin()
        service = MagicMock()
        service.create_initial_draft = AsyncMock(
            return_value={
                "id": "minute-1",
                "association_id": "11111111-1111-1111-1111-111111111111",
                "status": "DRAFT",
                "title": "Junta ordinaria marzo 2026",
                "location": "Residencial Vecinus",
                "type": "ORDINARY",
                "scheduled_at": "2026-03-24T19:00:00",
                "version": 1,
                "content_json": {
                    "transcription": "Texto",
                    "summary": "S",
                    "topics": [],
                    "agreements": [],
                    "tasks": [],
                },
            }
        )
        app.dependency_overrides[get_service] = lambda: service
        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: MagicMock()

        with patch("api.transcription.minutes.verify_association_admin_or_president"), patch.object(
            TranscriptionService,
            "process_audio_to_minutes",
            new=AsyncMock(
                return_value=AIGeneratedContent(transcription="Texto", summary="S", topics=[], agreements=[], tasks=[])
            ),
        ), patch.object(minutes_api, "get_audio_duration_seconds", return_value=120), patch.object(
            minutes_api,
            "consume_minutes_seconds",
            return_value={"allowed": True, "remaining_seconds": 7200, "resets_at": None},
        ), patch.object(
            minutes_api, "revert_minutes_seconds", return_value=None
        ):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                files = {"audio": ("reunion.mp3", b"fake-audio-data", "audio/mpeg")}
                response = await ac.post(
                    "/api/minutes/11111111-1111-1111-1111-111111111111/transcribe",
                    files=files,
                    data={"title": "Junta ordinaria marzo 2026"},
                )

        app.dependency_overrides.clear()
        response_data = response.json()

        if response.status_code != 200:
            raise AssertionError(f"Se esperaba 200 pero se obtuvo {response.status_code}")

        if response_data["title"] != "Junta ordinaria marzo 2026":
            raise AssertionError(f"Titulo inesperado en la respuesta: {response_data['title']}")

    async def test_transcribe_uses_client_duration_when_backend_probe_fails(self):
        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase_admin] = lambda: _MockSupabaseAdmin()
        app.dependency_overrides[get_supabase] = lambda: MagicMock()
        service = MagicMock()
        service.create_initial_draft = AsyncMock(
            return_value={
                "id": "minute-1",
                "association_id": "11111111-1111-1111-1111-111111111111",
                "status": "DRAFT",
                "title": "Junta webm",
                "location": "Residencial Vecinus",
                "type": "ORDINARY",
                "scheduled_at": "2026-03-24T19:00:00",
                "version": 1,
                "content_json": {
                    "transcription": "Texto",
                    "summary": "S",
                    "topics": [],
                    "agreements": [],
                    "tasks": [],
                },
            }
        )
        app.dependency_overrides[get_service] = lambda: service

        with patch("api.transcription.minutes.verify_association_admin_or_president"), patch.object(
            TranscriptionService,
            "process_audio_to_minutes",
            new=AsyncMock(
                return_value=AIGeneratedContent(transcription="Texto", summary="S", topics=[], agreements=[], tasks=[])
            ),
        ), patch.object(
            minutes_api, "get_audio_duration_seconds", side_effect=ValueError("ffprobe missing")
        ), patch.object(
            minutes_api,
            "consume_minutes_seconds",
            return_value={"allowed": True, "remaining_seconds": 7200, "resets_at": None},
        ) as mock_consume, patch.object(
            minutes_api, "revert_minutes_seconds", return_value=None
        ):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                files = {"audio": ("reunion.webm", b"fake-webm-audio-data", "audio/webm")}
                response = await ac.post(
                    "/api/minutes/11111111-1111-1111-1111-111111111111/transcribe",
                    files=files,
                    data={"title": "Junta webm", "duration_ms": "90500"},
                )

        app.dependency_overrides.clear()

        if response.status_code != 200:
            raise AssertionError(f"Se esperaba 200 pero se obtuvo {response.status_code}: {response.text}")

        mock_consume.assert_called_once()
        consumed_seconds = mock_consume.call_args.args[2]
        if consumed_seconds != 91:
            raise AssertionError(f"Se esperaba consumir 91s pero se consumieron {consumed_seconds}s")

    async def test_transcribe_unsupported_mime(self):
        app.dependency_overrides[get_current_user] = lambda: {
            "id": "11111111-1111-1111-1111-111111111110",
            "role": "authenticated",
            "email": "admin@test.com",
        }
        app.dependency_overrides[get_supabase_admin] = lambda: _MockSupabaseAdmin()
        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: MagicMock()
        app.dependency_overrides[get_service] = lambda: MagicMock()

        with patch("api.transcription.minutes.verify_association_admin_or_president"):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                files = {"audio": ("notas.txt", b"esto no es audio", "text/plain")}
                response = await ac.post(
                    "/api/minutes/11111111-1111-1111-1111-111111111111/transcribe",
                    files=files,
                    data={"title": "Acta"},
                )
        app.dependency_overrides.clear()

        if response.status_code != 415:
            raise AssertionError(f"Se esperaba 415 pero se obtuvo {response.status_code}")

    async def test_transcribe_file_exceeds_limit(self):
        app.dependency_overrides[get_current_user] = lambda: {
            "id": "11111111-1111-1111-1111-111111111110",
            "role": "authenticated",
            "email": "admin@test.com",
        }
        app.dependency_overrides[get_supabase_admin] = lambda: _MockSupabaseAdmin()
        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: MagicMock()
        app.dependency_overrides[get_service] = lambda: MagicMock()
        content = b"0" * (150 * 1024 * 1024 + 1)

        with patch("api.transcription.minutes.verify_association_admin_or_president"):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                files = {"audio": ("gigante.mp3", content, "audio/mpeg")}
                response = await ac.post(
                    "/api/minutes/11111111-1111-1111-1111-111111111111/transcribe",
                    files=files,
                    data={"title": "Acta"},
                )
        app.dependency_overrides.clear()

        if response.status_code != 413:
            raise AssertionError(f"Se esperaba 413 pero se obtuvo {response.status_code}")

    async def test_get_minutes_non_admin_returns_403(self):
        app.dependency_overrides[get_service] = lambda: MagicMock()
        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: MagicMock()
        app.dependency_overrides[require_active_community] = lambda: ASSOCIATION_ID

        with patch(
            "api.transcription.minutes.verify_association_membership",
            side_effect=HTTPException(status_code=403, detail="Access denied to this community"),
        ):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                response = await ac.get(f"/api/minutes/{ASSOCIATION_ID}")

        app.dependency_overrides.clear()

        if response.status_code != 403:
            raise AssertionError(f"Se esperaba 403 pero se obtuvo {response.status_code}")

    async def test_generate_document_preview_uses_minutes_title_as_filename(self):
        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        payload = {
            "title": "Junta ordinaria marzo 2026",
            "scheduled_at": "2026-03-24T19:00:00",
            "location": "Residencial Vecinus",
            "meeting_type": "ORDINARY",
            "version": 1,
            "transcription": "Texto",
            "summary": "S",
            "topics": [],
            "agreements": [],
            "tasks": [],
        }

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post("/api/minutes/generate-document-preview", json=payload)

        app.dependency_overrides.clear()
        content_disposition = response.headers.get("content-disposition", "")
        if response.status_code != 200:
            raise AssertionError(f"Se esperaba 200 pero se obtuvo {response.status_code}")

        if 'filename="Junta ordinaria marzo 2026.docx"' not in content_disposition:
            raise AssertionError(f"Cabecera Content-Disposition inesperada: {content_disposition}")

    async def test_unauthenticated_request_returns_401(self):
        app.dependency_overrides[get_supabase_admin] = lambda: _MockSupabaseAdmin()
        app.dependency_overrides[get_service] = lambda: MagicMock()
        app.dependency_overrides[require_active_community] = lambda: ASSOCIATION_ID
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get(f"/api/minutes/{ASSOCIATION_ID}")

        if response.status_code not in (401, 403):
            raise AssertionError(
                f"Se esperaba 401/403 para peticion sin autenticar pero se obtuvo {response.status_code}"
            )
