from google import genai
from backend.core.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)

# Modelo de embeddings compatible con la API v1beta del cliente actual
# Formato aceptado por el cliente actual para embed_content.
EMBEDDING_MODEL = "gemini-embedding-001"

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

def _chunk_text(text, max_chars=800):
    text = text.strip()
    chunks = []
    start = 0
    while start < len(text):
        end = start + max_chars
        chunk = text[start:end]
        chunks.append(chunk)
        start = end
    return chunks

def _embed_text(text):
    embedding_response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text
    )
    return embedding_response.embeddings[0].values

def index_document(comunidad_id, document_title, raw_text):
    chunks = _chunk_text(raw_text)
    stored = 0

    for i, chunk in enumerate(chunks):
        embedding = _embed_text(chunk)

        supabase.table("document_chunks").insert({
            "comunidad_id": comunidad_id,
            "title": document_title,
            "chunk_index": i,
            "texto": chunk,
            "embedding": embedding,
        }).execute()
        stored += 1

    return stored