import asyncio
import json
import logging
import os
import re
import tempfile

from dotenv import load_dotenv
from google import genai
from google.genai import types
from schemas.transcription.minutes import AIGeneratedContent

logger = logging.getLogger(__name__)

TRANSCRIPTION_PROMPT = """
Actua como un Secretario Juridico. Procesa el audio y devuelve un JSON estricto en español.
- transcription: Texto integro estructurado en parrafos cortos (max 4 lineas)
  con doble salto de linea.
- summary: Resumen ejecutivo narrativo.
- topics: Lista de puntos del orden del dia.
- agreements: Lista de objetos {description, result: 'APPROVED'|'DENIED', details}.
- tasks: Lista de objetos {responsible, description, deadline: 'YYYY-MM-DD'}.
NO incluyas explicaciones, solo el JSON.
"""

JSON_REPAIR_PROMPT_TEMPLATE = """
Convierte el siguiente contenido en un JSON VALIDO y estricto en español.
Debes devolver exclusivamente un objeto JSON sin markdown, sin comentarios y sin texto extra.
Manten el contenido semantico original y corrige solo formato, comillas, escapes y estructura.

Contenido a reparar:
{raw_text}
"""

TRANSCRIPTION_LINE_MAX_CHARS = 90
TRANSCRIPTION_PARAGRAPH_MAX_LINES = 4

MINUTES_SCHEMA = {
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
    },
    "required": ["transcription", "summary", "topics", "agreements", "tasks"],
}


def get_genai_client():
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    return genai.Client(api_key=api_key)


def _extract_json_block(raw_text: str) -> str:
    stripped = raw_text.strip()
    if stripped.startswith("```"):
        stripped = stripped.removeprefix("```json").removeprefix("```").strip()
        if stripped.endswith("```"):
            stripped = stripped[:-3].strip()

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start != -1 and end != -1 and end > start:
        return stripped[start : end + 1]
    return stripped


def _escape_newlines_inside_json_strings(raw_text: str) -> str:
    result = []
    in_string = False
    escaped = False

    for char in raw_text:
        if in_string:
            if escaped:
                result.append(char)
                escaped = False
            elif char == "\\":
                result.append(char)
                escaped = True
            elif char == '"':
                result.append(char)
                in_string = False
            elif char == "\n":
                result.append("\\n")
            elif char == "\r":
                result.append("\\r")
            elif char == "\t":
                result.append("\\t")
            else:
                result.append(char)
        else:
            result.append(char)
            if char == '"':
                in_string = True

    return "".join(result)


def _wrap_words(text: str, max_chars: int) -> list[str]:
    words = text.split()
    if not words:
        return []

    lines = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if len(candidate) <= max_chars:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _format_transcription_text(transcription: str) -> str:
    normalized = re.sub(r"\r\n?", "\n", transcription or "").strip()
    if not normalized:
        return ""

    raw_blocks = [re.sub(r"\s+", " ", block).strip() for block in re.split(r"\n\s*\n+", normalized) if block.strip()]
    if not raw_blocks:
        return ""

    paragraphs = []
    for block in raw_blocks:
        lines = _wrap_words(block, TRANSCRIPTION_LINE_MAX_CHARS)
        for index in range(0, len(lines), TRANSCRIPTION_PARAGRAPH_MAX_LINES):
            paragraph_lines = lines[index : index + TRANSCRIPTION_PARAGRAPH_MAX_LINES]
            paragraphs.append("\n".join(paragraph_lines))

    return "\n\n".join(paragraphs)


def _normalize_generated_minutes(minutes: AIGeneratedContent) -> AIGeneratedContent:
    return AIGeneratedContent(
        **{
            **minutes.model_dump(),
            "transcription": _format_transcription_text(minutes.transcription),
        }
    )


def _parse_generated_minutes_response(response) -> AIGeneratedContent:
    parsed = getattr(response, "parsed", None)
    if parsed is not None:
        if isinstance(parsed, AIGeneratedContent):
            return _normalize_generated_minutes(parsed)
        if hasattr(parsed, "model_dump"):
            return _normalize_generated_minutes(AIGeneratedContent(**parsed.model_dump()))
        if isinstance(parsed, dict):
            return _normalize_generated_minutes(AIGeneratedContent(**parsed))

    raw_text = getattr(response, "text", "") or ""
    if not raw_text.strip():
        raise RuntimeError("Gemini returned an empty response.")

    candidates = []
    json_block = _extract_json_block(raw_text)
    for candidate in (
        raw_text.strip(),
        json_block,
        _escape_newlines_inside_json_strings(json_block),
    ):
        if candidate and candidate not in candidates:
            candidates.append(candidate)

    last_error = None
    for candidate in candidates:
        try:
            return _normalize_generated_minutes(AIGeneratedContent(**json.loads(candidate)))
        except json.JSONDecodeError as exc:
            last_error = exc

    raise RuntimeError(f"Gemini returned invalid JSON: {last_error}")


async def _generate_structured_minutes(client, contents) -> object:
    return await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=contents,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=MINUTES_SCHEMA,
            temperature=0.1,
        ),
    )


async def _repair_invalid_minutes_json(client, raw_text: str) -> AIGeneratedContent:
    logger.warning("Gemini devolvio JSON invalido; intentando reparacion estructurada.")
    repaired_response = await _generate_structured_minutes(
        client,
        [JSON_REPAIR_PROMPT_TEMPLATE.format(raw_text=raw_text)],
    )
    return _parse_generated_minutes_response(repaired_response)


class TranscriptionService:
    @staticmethod
    async def process_audio_to_minutes(audio_bytes: bytes, mime_type: str = "audio/mpeg") -> AIGeneratedContent:
        client = get_genai_client()
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

        audio_file = None
        try:
            audio_file = await client.aio.files.upload(
                file=tmp_path,
                config=types.UploadFileConfig(mime_type=mime_type),
            )

            try:
                while audio_file.state == "PROCESSING":
                    await asyncio.sleep(1)
                    audio_file = await client.aio.files.get(name=audio_file.name)

                if audio_file.state == "FAILED":
                    raise RuntimeError("Gemini file processing failed.")

                file_part = types.Part.from_uri(
                    file_uri=audio_file.uri,
                    mime_type=audio_file.mime_type,
                )

                response = await _generate_structured_minutes(client, [TRANSCRIPTION_PROMPT, file_part])

                try:
                    return _parse_generated_minutes_response(response)
                except RuntimeError:
                    raw_text = getattr(response, "text", "") or ""
                    if not raw_text.strip():
                        raise
                    return await _repair_invalid_minutes_json(client, raw_text)

            finally:
                if audio_file:
                    try:
                        await client.aio.files.delete(name=audio_file.name)
                    except Exception as e:
                        logger.warning(
                            f"Error no critico: No se pudo eliminar {audio_file.name} de Gemini. Detalle: {e}"
                        )

        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)
