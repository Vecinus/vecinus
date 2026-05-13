from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from api.transcription.minutes import get_service
from core.deps import get_current_user, get_supabase
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from main import app
from schemas.transcription.minutes import AIGeneratedContent
from services.transcription.transcription_service import TranscriptionService

MOCK_USER = {"id": "user-1", "role": "authenticated", "email": "test@test.com"}
ASSOCIATION_ID = "11111111-1111-1111-1111-111111111111"


@pytest.mark.anyio
class TestMinutesAPI:
    async def test_transcribe_success(self):
        service = MagicMock()
        service.create_initial_draft = AsyncMock(
            return_value={
                "id": "minute-1",
                "association_id": ASSOCIATION_ID,
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
        ):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                files = {"audio": ("reunion.mp3", b"fake-audio-data", "audio/mpeg")}
                response = await ac.post(
                    f"/api/minutes/transcribe?association_id={ASSOCIATION_ID}&title=Junta%20ordinaria%20marzo%202026",
                    files=files,
                )

        app.dependency_overrides.clear()
        response_data = response.json()

        if response.status_code != 200:
            raise AssertionError(f"Se esperaba 200 pero se obtuvo {response.status_code}")

        if response_data["title"] != "Junta ordinaria marzo 2026":
            raise AssertionError(f"Titulo inesperado en la respuesta: {response_data['title']}")

    async def test_transcribe_non_admin_returns_403(self):
        app.dependency_overrides[get_service] = lambda: MagicMock()
        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: MagicMock()

        with patch(
            "api.transcription.minutes.verify_association_admin_or_president",
            side_effect=HTTPException(status_code=403, detail="Admin access required for this action"),
        ):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                files = {"audio": ("reunion.mp3", b"fake-audio-data", "audio/mpeg")}
                response = await ac.post(
                    f"/api/minutes/transcribe?association_id={ASSOCIATION_ID}&title=Acta",
                    files=files,
                )

        app.dependency_overrides.clear()

        if response.status_code != 403:
            raise AssertionError(f"Se esperaba 403 pero se obtuvo {response.status_code}")

    async def test_transcribe_unsupported_mime(self):
        app.dependency_overrides[get_service] = lambda: MagicMock()
        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: MagicMock()

        with patch("api.transcription.minutes.verify_association_admin_or_president"):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                files = {"audio": ("notas.txt", b"esto no es audio", "text/plain")}
                response = await ac.post(
                    f"/api/minutes/transcribe?association_id={ASSOCIATION_ID}&title=Acta",
                    files=files,
                )

        app.dependency_overrides.clear()

        if response.status_code != 415:
            raise AssertionError(f"Se esperaba 415 pero se obtuvo {response.status_code}")

    async def test_transcribe_file_exceeds_limit(self):
        app.dependency_overrides[get_service] = lambda: MagicMock()
        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: MagicMock()
        content = b"0" * (150 * 1024 * 1024 + 1)

        with patch("api.transcription.minutes.verify_association_admin_or_president"):
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                files = {"audio": ("gigante.mp3", content, "audio/mpeg")}
                response = await ac.post(
                    f"/api/minutes/transcribe?association_id={ASSOCIATION_ID}&title=Acta",
                    files=files,
                )

        app.dependency_overrides.clear()

        if response.status_code != 413:
            raise AssertionError(f"Se esperaba 413 pero se obtuvo {response.status_code}")

    async def test_get_minutes_non_admin_returns_403(self):
        app.dependency_overrides[get_service] = lambda: MagicMock()
        app.dependency_overrides[get_current_user] = lambda: MOCK_USER
        app.dependency_overrides[get_supabase] = lambda: MagicMock()

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
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get(f"/api/minutes/{ASSOCIATION_ID}")

        if response.status_code not in (401, 403):
            raise AssertionError(
                f"Se esperaba 401/403 para peticion sin autenticar pero se obtuvo {response.status_code}"
            )
