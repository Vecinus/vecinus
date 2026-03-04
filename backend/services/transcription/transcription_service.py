import asyncio
import json
import logging
import os
import tempfile

# The client will be initialized inside the function to ensure .env is loaded first.
from dotenv import load_dotenv
from google import genai
from google.genai import types
from schemas.transcription.minutes import MinutesResponse

logger = logging.getLogger(__name__)


def get_genai_client():
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    return genai.Client(api_key=api_key)


async def process_audio_to_minutes(audio_bytes: bytes, mime_type: str = "audio/mpeg") -> MinutesResponse:
    client = get_genai_client()
    # Determine file extension from mime type
    ext_map = {
        "audio/mpeg": ".mp3",
        "audio/wav": ".wav",
        "audio/x-wav": ".wav",
        "audio/ogg": ".ogg",
        "audio/flac": ".flac",
        "audio/mp4": ".mp4",
        "audio/webm": ".webm",
        "audio/x-m4a": ".m4a",
    }
    suffix = ext_map.get(mime_type, ".mp3")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_file:
        tmp_file.write(audio_bytes)
        tmp_path = tmp_file.name

    audio_file = None  # Inicializamos fuera del try para rastrear
    try:
        # 1. Subida del archivo
        audio_file = await client.aio.files.upload(
            path=tmp_path,
            config=types.UploadFileConfig(mime_type=mime_type),
        )

        try:
            # Wait until the file is processed and ACTIVE
            while audio_file.state == "PROCESSING":
                await asyncio.sleep(1)
                audio_file = await client.aio.files.get(name=audio_file.name)

            if audio_file.state == "FAILED":
                raise RuntimeError("Gemini file processing failed.")

            prompt = """
            Eres un asistente experto que genera actas de reuniones de comunidades de vecinos.
            Escucha el siguiente audio y elabora un acta estructurada en español.
            Debes extraer la transcripción literal (transcription), las tareas (tasks),
            los temas tratados (topics), los acuerdos (agreements) y un resumen (summary).
            """

            file_part = types.Part.from_uri(
                file_uri=audio_file.uri,
                mime_type=audio_file.mime_type,
            )

            # Se define el schema manualmente para evitar errores
            # con los Pydantic $ref/$defs, que Gemini no maneja correctamente.
            minutes_schema = {
                "type": "OBJECT",
                "properties": {
                    "transcription": {"type": "STRING"},
                    "summary": {"type": "STRING"},
                    "topics": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "agreements": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "tasks": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "responsible": {"type": "STRING"},
                                "description": {"type": "STRING"},
                                "deadline": {"type": "STRING"},
                            },
                            "required": ["responsible", "description", "deadline"],
                        },
                    },
                },
                "required": ["transcription", "summary", "topics", "agreements", "tasks"],
            }

            response = await client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=[prompt, file_part],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=minutes_schema,
                    temperature=0.2,
                ),
            )

            acta_dict = json.loads(response.text)
            return MinutesResponse(**acta_dict)

        finally:
            # LIMPIEZA EN LA NUBE: Se ejecuta si la subida tuvo éxito
            # independientemente del resultado del procesamiento
            if audio_file:
                try:
                    await client.aio.files.delete(name=audio_file.name)
                except Exception as e:
                    logger.warning(f"Error no crítico: No se pudo eliminar {audio_file.name} de Gemini. Detalle: {e}")

    finally:
        # LIMPIEZA LOCAL: Se ejecuta siempre para no llenar el disco del servidor.
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
