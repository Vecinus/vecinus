from google import genai
from pinecone import Pinecone

from backend.core.config import settings

# Conectamos con Pinecone y Gemini
pc = Pinecone(api_key=settings.PINECONE_API_KEY)
index = pc.Index(settings.PINECONE_INDEX_NAME)
client = genai.Client(api_key=settings.GEMINI_API_KEY)

# Nombre exacto del modelo para evitar el error 404
EMBEDDING_MODEL = "gemini-embedding-001"


def _chunk_text_with_overlap(text, chunk_size=800, overlap=150):
    """Corta el texto con solapamiento."""
    text = text.strip()
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        start += chunk_size - overlap
    return chunks


def index_document(comunidad_id, document_title, raw_text):
    chunks = _chunk_text_with_overlap(raw_text)
    if not chunks:
        return 0

    vectors = []
    for i, chunk_text in enumerate(chunks):
        chunk_id = f"{comunidad_id}-{document_title}-{i}"

        # Generar embedding con Google Gemini (768 dimensiones)
        response = client.models.embed_content(
            model=EMBEDDING_MODEL, contents=chunk_text
        )

        vectors.append(
            {
                "id": chunk_id,
                "values": response.embeddings[0].values,
                "metadata": {
                    "comunidad_id": str(comunidad_id),
                    "document_title": document_title,
                    "chunk_index": i,
                    "texto": chunk_text,
                },
            }
        )

    # Subimos todos los vectores a Pinecone
    if vectors:
        index.upsert(
            vectors=vectors,
            namespace=str(comunidad_id),
        )

    return len(vectors)
