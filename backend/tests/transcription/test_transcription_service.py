from unittest.mock import AsyncMock, MagicMock, PropertyMock, patch

import pytest
from services.transcription.transcription_service import (
    process_audio_to_minutes,
)


@pytest.mark.anyio
class TestTranscriptionService:

    # --- TESTS POSITIVOS ---

    async def test_process_audio_to_minutes_logic(self):
        # Mock del archivo devuelto por Gemini
        mock_file = MagicMock()
        mock_file.name = "files/mock-123"
        mock_file.uri = "https://mock.uri"
        # Asignar un string real para evitar el ValidationError de Pydantic
        mock_file.mime_type = "audio/mpeg"

        # Se requieren 3 valores: 1 para entrar al bucle, 1 para salir, 1 para el check de FAILED
        type(mock_file).state = PropertyMock(side_effect=["PROCESSING", "ACTIVE", "ACTIVE"])

        # Mock de la respuesta de generación
        mock_response = MagicMock()
        mock_response.text = (
            '{"transcription": "Lógica interna", "summary": "S", "topics": [], "agreements": [], "tasks": []}'
        )

        with patch("services.transcription.transcription_service.get_genai_client") as mock_client_factory:
            client = mock_client_factory.return_value
            client.aio.files.upload = AsyncMock(return_value=mock_file)
            client.aio.files.get = AsyncMock(return_value=mock_file)
            client.aio.models.generate_content = AsyncMock(return_value=mock_response)
            client.aio.files.delete = AsyncMock()

            result = await process_audio_to_minutes(b"audio_data", "audio/mpeg")

            assert result.transcription == "Lógica interna"
            # Verificamos que se llamó al borrado para no dejar basura en la nube
            client.aio.files.delete.assert_called_with(name=mock_file.name)

    # --- TESTS NEGATIVOS ---

    async def test_process_audio_to_minutes_failed_state(self):
        """Verifica que se lanza RuntimeError cuando Gemini marca el archivo como FAILED."""

        # 1. Configuración del Mock del archivo
        mock_file = MagicMock()
        mock_file.name = "files/mock-error"
        mock_file.mime_type = "audio/mpeg"

        # Necesitamos 2 valores: uno para el 'while' (evitar entrada) y uno para el check de FAILED
        type(mock_file).state = PropertyMock(side_effect=["FAILED", "FAILED"])

        with patch("services.transcription.transcription_service.get_genai_client") as mock_client_factory:
            client = mock_client_factory.return_value
            client.aio.files.upload = AsyncMock(return_value=mock_file)
            client.aio.files.get = AsyncMock(return_value=mock_file)
            client.aio.files.delete = AsyncMock()  # Preparamos el mock de borrado

            # 2. Ejecución y Verificación de la excepción
            with pytest.raises(RuntimeError, match="Gemini file processing failed"):
                await process_audio_to_minutes(b"audio_data", "audio/mpeg")

            # 3. Verificación de limpieza
            # Aunque falle el proceso, el archivo debe haberse intentado borrar
            client.aio.files.delete.assert_called_once_with(name=mock_file.name)
