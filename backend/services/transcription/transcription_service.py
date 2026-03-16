import asyncio
import json
import logging
import os
import tempfile

# The client will be initialized inside the function to ensure .env is loaded first.
from dotenv import load_dotenv
from google import genai
from google.genai import types
from schemas.transcription.minutes import AIGeneratedContent

logger = logging.getLogger(__name__)
PEPPER_GLOBAL = os.getenv("PEPPER_GLOBAL")


def get_genai_client():
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    return genai.Client(api_key=api_key)


class TranscriptionService:
    @staticmethod
    async def process_audio_to_minutes(audio_bytes: bytes, mime_type: str = "audio/mpeg") -> AIGeneratedContent:
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
                    Actúa como un Secretario Jurídico. Procesa el audio y devuelve un JSON estricto.
                    - transcription: Texto íntegro estructurado en párrafos cortos (máx 4 líneas)
                        con doble salto de línea.
                    - summary: Resumen ejecutivo narrativo.
                    - topics: Lista de puntos del orden del día.
                    - agreements: Lista de objetos {description, result: 'APPROVED'|'DENIED', details}.
                    - tasks: Lista de objetos {responsible, description, deadline: 'YYYY-MM-DD'}.
                    - attendees: Lista de objetos {name, role, is_present, represented_by}.
                    NO incluyas explicaciones, solo el JSON.
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
                        "agreements": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "description": {"type": "STRING"},
                                    "result": {"type": "STRING", "enum": ["APPROVED", "DENIED"]},
                                    "details": {"type": "STRING"},
                                },
                                "required": ["description", "result"],
                            },
                        },
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
                        "attendees": {
                            "type": "ARRAY",
                            "items": {
                                "type": "OBJECT",
                                "properties": {
                                    "name": {"type": "STRING"},
                                    "role": {"type": "STRING", "enum": ["PRESIDENT", "SECRETARY", "ATTENDEE"]},
                                    "is_present": {"type": "BOOLEAN"},
                                    "represented_by": {"type": "STRING"},
                                },
                                "required": ["name", "role", "is_present"],
                            },
                        },
                    },
                    "required": ["transcription", "summary", "topics", "agreements", "tasks", "attendees"],
                }

                response = await client.aio.models.generate_content(
                    model="gemini-2.5-flash",
                    contents=[prompt, file_part],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=minutes_schema,
                        temperature=0.1,  # Bajamos la temperatura para máxima fidelidad de transcripción
                    ),
                )

                acta_dict = json.loads(response.text)
                return AIGeneratedContent(**acta_dict)

            finally:
                # LIMPIEZA EN LA NUBE: Se ejecuta si la subida tuvo éxito
                # independientemente del resultado del procesamiento
                if audio_file:
                    try:
                        await client.aio.files.delete(name=audio_file.name)
                    except Exception as e:
                        logger.warning(
                            f"Error no crítico: No se pudo eliminar {audio_file.name} de Gemini. Detalle: {e}"
                        )

        finally:
            # LIMPIEZA LOCAL: Se ejecuta siempre para no llenar el disco del servidor.
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
