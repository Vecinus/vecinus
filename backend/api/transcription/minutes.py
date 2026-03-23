from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from schemas.transcription.minutes import MeetingType, MinutesReadResponse, MinutesResponse
from services.transcription.document_service import DocumentService
from services.transcription.minute_service import MinuteService
from services.transcription.transcription_service import TranscriptionService

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


# Dependencia para obtener el servicio ya configurado
def get_service(db=Depends(MinuteService.get_supabase_client)):
    return MinuteService(db)


@router.get("/{association_id}", response_model=List[MinutesReadResponse])
async def get_minutes(
    association_id: UUID,
    service: MinuteService = Depends(get_service),
):
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
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching minutes: {str(e)}",
        )


@router.post("/transcribe", response_model=MinutesReadResponse)
async def transcribe_meeting(
    association_id: UUID,
    title: str,
    location: str = "Residencial Vecinus",
    meeting_type: MeetingType = MeetingType.ORDINARY,
    scheduled_at: datetime = None,
    audio: UploadFile = File(...),
    service: MinuteService = Depends(get_service),
):
    if not scheduled_at:
        scheduled_at = datetime.now()
    if audio.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio format: {audio.content_type}",
        )

    audio_bytes = await audio.read()

    if len(audio_bytes) > MAX_FILE_SIZE:
        del audio_bytes
        raise HTTPException(
            status_code=413,
            detail="File size exceeds the 150 MB limit",
        )

    try:
        # Lógica de IA (Servicio ya refactorizado a clase)
        ai_service = TranscriptionService()
        ai_content = await ai_service.process_audio_to_minutes(audio_bytes, mime_type=audio.content_type)

        full_minute_response = MinutesResponse(
            title=title,
            location=location,
            meeting_type=meeting_type,
            scheduled_at=scheduled_at,
            version=1,
            **ai_content.model_dump(),  # Expandimos los campos de la IA (transcription, summary, etc.)
        )

        db_result = await service.create_initial_draft(association_id, full_minute_response)

        result = MinutesReadResponse(
            id=db_result["id"],
            association_id=db_result["association_id"],
            status=db_result["status"],
            title=db_result["title"],
            location=db_result["location"],
            meeting_type=db_result["type"],  # Mapeamos 'type' (DB) a 'meeting_type' (Modelo)
            scheduled_at=db_result["scheduled_at"],
            version=db_result["version"],
            document_hash=db_result.get("document_hash"),
            created_at=db_result.get("created_at"),
            updated_at=db_result.get("updated_at"),
            locked_at=db_result.get("locked_at"),
            # Sacamos todo lo que está dentro de content_json a la raíz
            **db_result["content_json"],
        )

        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing audio: {str(e)}",
        )
    finally:
        del audio_bytes
        await audio.close()


@router.post("/generate-document-preview")
async def generate_minutes_document_preview(minutes: MinutesResponse):
    """Visualizar acta en frontend mientras se edita el borrador,
    sin guardarlo todavía en la BD"""
    try:
        buffer = DocumentService.generate_docx(minutes)
        return StreamingResponse(
            buffer,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": "attachment; filename=acta_reunion.docx"},
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating document: {str(e)}",
        )
