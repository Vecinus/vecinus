from google import genai
from backend.core.config import settings
import uuid
from pinecone import Pinecone

# Conectamos con Pinecone
pc = Pinecone(api_key=settings.PINECONE_API_KEY)
index = pc.Index(settings.PINECONE_INDEX_NAME)

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

def index_document(comunidad_id, document_title, raw_text):
    chunks = _chunk_text(raw_text)
    records = []

    for i, chunk in enumerate(chunks):
        doc_title_clean = document_title.replace(" ", "_")
        chunk_id = f"{comunidad_id}-{doc_title_clean}-{i}-{uuid.uuid4().hex[:4]}"
        
        records.append({
            "id": chunk_id,
            "text": chunk, # Este campo es el que lee Pinecone para hacer la vectorización mágica
            "metadata": {
                "comunidad_id": int(comunidad_id),
                "document_title": document_title,
                "chunk_index": i,
                "texto": chunk # Lo guardamos también aquí para leerlo fácil en las respuestas
            }
        })

    # Subimos todos los trozos de golpe a Pinecone
    if records:
        index.upsert(records)

    return len(records)