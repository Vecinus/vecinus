from unittest.mock import AsyncMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from main import app


@pytest.mark.anyio
class TestMinutesAPI:

    # --- TESTS POSITIVOS ---

    async def test_transcribe_success(self):
        """Prueba que un audio válido devuelve un MinutesResponse 200."""
        payload = {"transcription": "Texto", "summary": "S", "topics": [], "agreements": [], "tasks": []}
        with patch("api.transcription.minutes.process_audio_to_minutes", new_callable=AsyncMock) as mock:
            mock.return_value = payload
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                files = {"audio": ("reunion.mp3", b"fake-audio-data", "audio/mpeg")}
                response = await ac.post("/api/minutes/transcribe", files=files)
                response_data = response.json()

        if response.status_code != 200:
            raise AssertionError(f"Se esperaba 200 pero se obtuvo {response.status_code}")

        target_key = "transcription"
        if target_key not in response_data:
            raise AssertionError(
                f"La clave {target_key} no está presente en la respuesta."
                + f"Claves recibidas: {list(response_data.keys())}"
            )

    # --- TESTS NEGATIVOS ---

    async def test_transcribe_unsupported_mime(self):
        """Prueba que un archivo .txt es rechazado con 415."""
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            files = {"audio": ("notas.txt", b"esto no es audio", "text/plain")}
            response = await ac.post("/api/minutes/transcribe", files=files)
        if response.status_code != 415:
            raise AssertionError(f"Se esperaba 415 pero se obtuvo {response.status_code}")

    async def test_transcribe_file_exceeds_limit(self):
        """Prueba que un archivo de >150MB es rechazado con 413."""
        content = b"0" * (150 * 1024 * 1024 + 1)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            files = {"audio": ("gigante.mp3", content, "audio/mpeg")}
            response = await ac.post("/api/minutes/transcribe", files=files)
        if response.status_code != 413:
            raise AssertionError(f"Se esperaba 413 pero se obtuvo {response.status_code}")
