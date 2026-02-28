from fastapi import APIRouter, UploadFile, File, HTTPException

from schemas.minutes import MinutesResponse
from services.transcription_service import process_audio_to_minutes

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
        result = await process_audio_to_minutes(audio_bytes)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing audio: {str(e)}",
        )
    finally:
        del audio_bytes
        await audio.close()
