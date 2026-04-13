from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch

import pytest
from services.transcription.transcription_service import TranscriptionService


@pytest.mark.anyio
class TestTranscriptionService:
    async def test_process_audio_to_minutes_logic(self):
        mock_file = MagicMock()
        mock_file.name = "files/mock-123"
        mock_file.uri = "https://mock.uri"
        mock_file.mime_type = "audio/mpeg"
        type(mock_file).state = PropertyMock(side_effect=["PROCESSING", "ACTIVE", "ACTIVE"])

        mock_response = MagicMock()
        mock_response.parsed = {
            "transcription": (
                "Logica interna con suficiente longitud para que el servicio la convierta en lineas mas manejables "
                "y en varios bloques de texto antes de devolverla al frontend."
            ),
            "summary": "S",
            "topics": [],
            "agreements": [],
            "tasks": [],
        }
        mock_response.text = '{"transcription":"Texto","summary":"S","topics":[],"agreements":[],"tasks":[]}'

        with patch("services.transcription.transcription_service.get_genai_client") as mock_client_factory:
            client = mock_client_factory.return_value
            client.aio.files.upload = AsyncMock(return_value=mock_file)
            client.aio.files.get = AsyncMock(return_value=mock_file)
            client.aio.models.generate_content = AsyncMock(return_value=mock_response)
            client.aio.files.delete = AsyncMock()

            result = await TranscriptionService.process_audio_to_minutes(b"audio_data", "audio/mpeg")

            if "\n" not in result.transcription:
                raise AssertionError(f"Se esperaba una transcripcion estructurada y se obtuvo {result.transcription!r}")

            client.aio.files.upload.assert_called_once()
            upload_kwargs = client.aio.files.upload.await_args.kwargs
            if upload_kwargs.get("file") is None:
                raise AssertionError(f"Se esperaba usar el argumento 'file' en upload y se obtuvo {upload_kwargs}")

            client.aio.files.delete.assert_called_with(name=mock_file.name)

    async def test_process_audio_to_minutes_recovers_invalid_json_text(self):
        mock_file = MagicMock()
        mock_file.name = "files/mock-124"
        mock_file.uri = "https://mock.uri"
        mock_file.mime_type = "audio/mpeg"
        type(mock_file).state = PropertyMock(side_effect=["ACTIVE", "ACTIVE"])

        mock_response = MagicMock()
        mock_response.parsed = None
        mock_response.text = """{
  "transcription": "Linea 1
Linea 2",
  "summary": "S",
  "topics": [],
  "agreements": [],
  "tasks": []
}"""

        with patch("services.transcription.transcription_service.get_genai_client") as mock_client_factory:
            client = mock_client_factory.return_value
            client.aio.files.upload = AsyncMock(return_value=mock_file)
            client.aio.files.get = AsyncMock(return_value=mock_file)
            client.aio.models.generate_content = AsyncMock(return_value=mock_response)
            client.aio.files.delete = AsyncMock()

            result = await TranscriptionService.process_audio_to_minutes(b"audio_data", "audio/mpeg")

            if result.transcription != "Linea 1 Linea 2":
                raise AssertionError(
                    f"No se recupero correctamente la transcripcion multilinea: {result.transcription!r}"
                )

    async def test_process_audio_to_minutes_repairs_unrecoverable_json_with_second_call(self):
        mock_file = MagicMock()
        mock_file.name = "files/mock-125"
        mock_file.uri = "https://mock.uri"
        mock_file.mime_type = "audio/mpeg"
        type(mock_file).state = PropertyMock(side_effect=["ACTIVE", "ACTIVE"])

        first_response = MagicMock()
        first_response.parsed = None
        first_response.text = (
            '{"transcription": "Linea "rota", "summary": "S", "topics": [], "agreements": [], "tasks": []}'
        )

        repaired_response = MagicMock()
        repaired_response.parsed = {
            "transcription": 'Linea "rota"',
            "summary": "S",
            "topics": [],
            "agreements": [],
            "tasks": [],
        }
        repaired_response.text = (
            '{"transcription":"Linea \\"rota\\"","summary":"S","topics":[],"agreements":[],"tasks":[]}'
        )

        with patch("services.transcription.transcription_service.get_genai_client") as mock_client_factory:
            client = mock_client_factory.return_value
            client.aio.files.upload = AsyncMock(return_value=mock_file)
            client.aio.files.get = AsyncMock(return_value=mock_file)
            client.aio.models.generate_content = AsyncMock(side_effect=[first_response, repaired_response])
            client.aio.files.delete = AsyncMock()

            result = await TranscriptionService.process_audio_to_minutes(b"audio_data", "audio/mpeg")

            if result.transcription != 'Linea "rota"':
                raise AssertionError(f"No se aplico la reparacion de JSON esperada: {result.transcription!r}")

            if client.aio.models.generate_content.await_count != 2:
                raise AssertionError("Se esperaba una segunda llamada para reparar el JSON invalido.")

    async def test_process_audio_to_minutes_failed_state(self):
        mock_file = MagicMock()
        mock_file.name = "files/mock-error"
        mock_file.mime_type = "audio/mpeg"
        type(mock_file).state = PropertyMock(side_effect=["FAILED", "FAILED"])

        with patch("services.transcription.transcription_service.get_genai_client") as mock_client_factory:
            client = mock_client_factory.return_value
            client.aio.files.upload = AsyncMock(return_value=mock_file)
            client.aio.files.get = AsyncMock(return_value=mock_file)
            client.aio.files.delete = AsyncMock()

            with pytest.raises(RuntimeError, match="Gemini file processing failed"):
                await TranscriptionService.process_audio_to_minutes(b"audio_data", "audio/mpeg")

            client.aio.files.delete.assert_called_once_with(name=mock_file.name)
