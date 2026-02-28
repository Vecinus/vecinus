from google import genai
from backend.core.config import settings
import uuid
from pinecone import Pinecone

client = genai.Client(api_key=settings.GEMINI_API_KEY)

# Conectamos con Pinecone
pc = Pinecone(api_key=settings.PINECONE_API_KEY)

index = pc.Index("chatbot-3072")

# Modelo de embeddings compatible con la API v1beta del cliente actual
# Formato aceptado por el cliente actual para embed_content.
EMBEDDING_MODEL = "gemini-embedding-001"

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

def _embed_content(text):
    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
    )
    return response.embeddings[0].values

def index_document(comunidad_id, document_title, raw_text):
    comunidad_id = comunidad_id
    chunks = _chunk_text(raw_text)
    vectors = []

    for i, chunk in enumerate(chunks):
        if not chunk.strip():
            continue
        chunk_id = f"{comunidad_id}-{document_title}-{i}"
        embedding = _embed_content(chunk)
        
        vectors.append({
            "id": chunk_id,
            "values": embedding, # Este campo es el que lee Pinecone para hacer la vectorización mágica
            "metadata": {
                "comunidad_id": comunidad_id,
                "document_title": document_title,
                "chunk_index": i,
                "texto": chunk # Lo guardamos también aquí para leerlo fácil en las respuestas
            }
        })

    # Subimos todos los trozos de golpe a Pinecone
    if vectors:
        index.upsert(
            vectors=vectors,
            namespace=str(comunidad_id),
        )

    return len(vectors)