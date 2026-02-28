import io
import gc
import json
import tempfile
import os

from faster_whisper import WhisperModel
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate

from schemas.minutes import MinutesResponse


WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")


async def transcribe_audio(audio_bytes: bytes) -> str:
    model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")

    tmp_fd, tmp_path = tempfile.mkstemp(suffix=".wav")
    try:
        with os.fdopen(tmp_fd, "wb") as tmp_file:
            tmp_file.write(audio_bytes)

        segments, _ = model.transcribe(tmp_path, beam_size=5)
        transcription = " ".join(segment.text for segment in segments)
    finally:
        os.unlink(tmp_path)
        del audio_bytes
        gc.collect()

    return transcription


async def generate_minutes(transcription: str) -> MinutesResponse:
    llm = ChatOllama(
        model=OLLAMA_MODEL,
        base_url=OLLAMA_BASE_URL,
        temperature=0,
        format="json",
    )

    prompt = ChatPromptTemplate.from_messages(
        [
            (
                "system",
                (
                    "You are an expert assistant that generates structured meeting "
                    "minutes from transcriptions. You MUST respond ONLY with a valid "
                    "JSON object with the following keys:\n"
                    '- "summary": a concise summary of the meeting\n'
                    '- "topics": a list of discussed topics\n'
                    '- "agreements": a list of agreements reached\n'
                    '- "tasks": a list of objects with keys "responsible", '
                    '"description", and "deadline"\n'
                    "Do not include any text outside the JSON object."
                ),
            ),
            (
                "human",
                "Generate structured meeting minutes from the following "
                "transcription:\n\n{transcription}",
            ),
        ]
    )

    chain = prompt | llm
    response = chain.invoke({"transcription": transcription})

    parsed = json.loads(response.content)
    return MinutesResponse(**parsed)


async def process_audio_to_minutes(audio_bytes: bytes) -> MinutesResponse:
    try:
        transcription = await transcribe_audio(audio_bytes)
        minutes = await generate_minutes(transcription)
        return minutes
    finally:
        del audio_bytes
        gc.collect()
