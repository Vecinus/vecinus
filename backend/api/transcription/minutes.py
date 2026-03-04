from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from schemas.transcription.minutes import MinutesResponse
from services.document_service import generate_docx
from services.transcription.transcription_service import process_audio_to_minutes

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


@router.post("/transcribe", response_model=MinutesResponse)
async def transcribe_meeting(audio: UploadFile = File(...)):
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
        result = await process_audio_to_minutes(audio_bytes, mime_type=audio.content_type)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing audio: {str(e)}",
        )
    finally:
        del audio_bytes
        await audio.close()


@router.post("/generate-document")
async def generate_minutes_document(minutes: MinutesResponse):
    try:
        buffer = generate_docx(minutes)
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
