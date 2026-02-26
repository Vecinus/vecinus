from google import genai
from backend.core.config import settings

client = genai.Client(api_key=settings.GEMINI_API_KEY)

# Modelo de embeddings compatible con la API v1beta del cliente actual
# Formato aceptado por el cliente actual para embed_content.
EMBEDDING_MODEL = "gemini-embedding-001"

MEMORY = {}

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
    
    if comunidad_id not in MEMORY:
        MEMORY[comunidad_id] = []
    stored = 0
    for i, chunk in enumerate(chunks):
        embedding = _embed_text(chunk)
        MEMORY[comunidad_id].append(
            {
                "chunk_id": f"{document_title}-{i}",
                "text": chunk,
                "embedding": embedding,
            }
        )
        stored += 1
    
    return stored