import json
import tempfile
import os

from google import genai
from google.genai import types

from schemas.transcription.minutes import MinutesResponse

# The client will be initialized inside the function to ensure .env is loaded first.
from dotenv import load_dotenv

def get_genai_client():
    load_dotenv()
    api_key = os.environ.get("GEMINI_API_KEY")
    # If GEMINI_API_KEY is not set, the SDK might also look for GOOGLE_API_KEY automatically.
    return genai.Client(api_key=api_key)

async def process_audio_to_minutes(audio_bytes: bytes) -> MinutesResponse:
    client = get_genai_client()
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
        tmp_file.write(audio_bytes)
        tmp_path = tmp_file.name

    try:
        audio_file = await client.aio.files.upload(file=tmp_path)

        prompt = """
        Eres un asistente experto que genera actas de reuniones de comunidades de vecinos.
        Escucha el siguiente audio y elabora un acta estructurada en español.
        Debes extraer las tareas (tasks), los temas tratados (topics), los acuerdos (agreements) y un resumen (summary).
        """

        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt, audio_file],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=MinutesResponse,
                temperature=0.2, # Added slightly lower temp for structured data consistency
            )
        )
        
        await client.aio.files.delete(name=audio_file.name)
        
        acta_dict = json.loads(response.text)
        return MinutesResponse(**acta_dict)

    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
