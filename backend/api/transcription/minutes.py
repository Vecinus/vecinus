import math
from datetime import datetime
from typing import List
from urllib.parse import quote
from uuid import UUID

from api.chat.chat_helpers import verify_association_admin_or_president, verify_association_membership
from core.deps import get_current_user, get_supabase, get_supabase_admin, require_active_community
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from schemas.transcription.minutes import (
    MeetingType,
    MinutesReadResponse,
    MinutesResponse,
)
from services.payments.usage_service import (
    consume_minutes_seconds,
    revert_minutes_seconds,
)
from services.transcription.document_service import DocumentService
from services.transcription.minute_service import MinuteService
from services.transcription.transcription_service import (
    TranscriptionService,
    get_audio_duration_seconds,
)
from supabase import Client

router = APIRouter(prefix="/api/minutes", tags=["Minutes"])

ALLOWED_CONTENT_TYPES = {
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/ogg",
    "audio/flac",
    "audio/mp4",
    "audio/webm",
    "audio/x-m4a",
}

MAX_FILE_SIZE = 150 * 1024 * 1024


def _duration_seconds_from_client_ms(duration_ms: int | None) -> int | None:
    if duration_ms is None or duration_ms <= 0:
        return None
    return max(1, math.ceil(duration_ms / 1000))


def get_service(db=Depends(MinuteService.get_supabase_client)):
    return MinuteService(db)


@router.get(
    "/{association_id}",
    response_model=List[MinutesReadResponse],
    dependencies=[Depends(require_active_community)],
)
async def get_minutes(
    association_id: UUID,
    service: MinuteService = Depends(get_service),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    verify_association_membership(association_id, user["id"], supabase)
    try:
        db_results = await service.get_minutes_by_association(association_id)
        results = []
        for row in db_results:
            results.append(
                MinutesReadResponse(
                    id=row["id"],
                    association_id=row["association_id"],
                    status=row["status"],
                    title=row["title"],
                    location=row["location"] or "",
                    meeting_type=row["type"],
                    scheduled_at=row["scheduled_at"],
                    version=row["version"],
                    document_hash=row.get("document_hash"),
                    created_at=row.get("created_at"),
                    updated_at=row.get("updated_at"),
                    locked_at=row.get("locked_at"),
                    **row["content_json"],
                )
            )
        return results
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Error al obtener las actas",
        )


@router.post(
    "/{association_id}/transcribe",
    response_model=MinutesReadResponse,
    dependencies=[Depends(require_active_community)],
)
async def transcribe_meeting(
    association_id: UUID,
    audio: UploadFile = File(...),
    title: str = Form(...),
    location: str = Form(""),
    meeting_type: MeetingType = Form(MeetingType.ORDINARY),
    scheduled_at: datetime | None = Form(None),
    duration_ms: int | None = Form(None),
    supabase_admin: Client = Depends(get_supabase_admin),
    service: MinuteService = Depends(get_service),
    user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    verify_association_admin_or_president(association_id, user["id"], supabase)
    if not scheduled_at:
        scheduled_at = datetime.now()
    if audio.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio format: {audio.content_type}",
        )

    chunk_size = 1024 * 1024
    audio_chunks = []
    total_size = 0
    while True:
        chunk = await audio.read(chunk_size)
        if not chunk:
            break
        total_size += len(chunk)
        if total_size > MAX_FILE_SIZE:
            del audio_chunks
            raise HTTPException(
                status_code=413,
                detail="File size exceeds the 150 MB limit",
            )
        audio_chunks.append(chunk)
    audio_bytes = b"".join(audio_chunks)
    del audio_chunks

    # Calcular la duracion antes de tocar Gemini para descontar cupo. En
    # WebM de navegador movil algunos entornos no pueden leer la metadata; si
    # el cliente envio la duracion medida por la grabadora, se usa de respaldo.
    client_duration_seconds = _duration_seconds_from_client_ms(duration_ms)
    try:
        duration_seconds = get_audio_duration_seconds(audio_bytes, audio.content_type)
    except ValueError as exc:
        if client_duration_seconds is None:
            raise HTTPException(
                status_code=422,
                detail=f"No se pudo determinar la duración del audio: {exc}",
            )
        duration_seconds = client_duration_seconds

    if duration_seconds <= 0:
        raise HTTPException(
            status_code=422,
            detail="No se pudo determinar la duración del audio: duracion no valida",
        )

    # Reservar cuota de actas (segundos). Atómico vía RPC.
    consumption = consume_minutes_seconds(supabase_admin, str(association_id), duration_seconds)
    if not consumption["allowed"]:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "quota_exhausted",
                "resource": "minutes",
                "message": (
                    "Se agotó el cupo de minutos de actas para este periodo "
                    f"(necesitabas {duration_seconds}s, restantes "
                    f"{consumption['remaining_seconds']}s)."
                ),
                "requested_seconds": duration_seconds,
                "remaining_seconds": consumption["remaining_seconds"],
                "resets_at": consumption.get("resets_at"),
            },
        )

    try:
        ai_service = TranscriptionService()
        ai_content = await ai_service.process_audio_to_minutes(audio_bytes, mime_type=audio.content_type)

        full_minute_response = MinutesResponse(
            title=title,
            location=location,
            meeting_type=meeting_type,
            scheduled_at=scheduled_at,
            version=1,
            **ai_content.model_dump(),
        )

        db_result = await service.create_initial_draft(association_id, full_minute_response)

        return MinutesReadResponse(
            id=db_result["id"],
            association_id=db_result["association_id"],
            status=db_result["status"],
            title=db_result["title"],
            location=db_result["location"],
            meeting_type=db_result["type"],
            scheduled_at=db_result["scheduled_at"],
            version=db_result["version"],
            document_hash=db_result.get("document_hash"),
            created_at=db_result.get("created_at"),
            updated_at=db_result.get("updated_at"),
            locked_at=db_result.get("locked_at"),
            **db_result["content_json"],
        )
    except Exception as e:
        # Compensación: si falla el procesado, devolvemos los segundos al cupo
        # para no penalizar al usuario por un fallo nuestro.
        revert_minutes_seconds(supabase_admin, str(association_id), duration_seconds)
        error_str = str(e)
        if "503" in error_str or "429" in error_str:
            raise HTTPException(
                status_code=503,
                detail="El servicio de inteligencia artificial está saturado o temporalmente no disponible. "
                "Por favor, inténtalo de nuevo en unos minutos.",
            )
        raise HTTPException(
            status_code=500,
            detail="Error al procesar el audio",
        )
    finally:
        del audio_bytes
        await audio.close()


@router.post("/generate-document-preview")
async def generate_minutes_document_preview(
    minutes: MinutesResponse,
    user: dict = Depends(get_current_user),
):
    try:
        buffer = DocumentService.generate_docx(minutes)
        filename = DocumentService.build_docx_filename(minutes.title)
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{quote(filename)}"},
        )
    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Error al generar el documento",
        )
