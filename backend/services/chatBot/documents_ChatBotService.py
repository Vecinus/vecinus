from pinecone import Pinecone
from backend.core.config import settings

# Conectamos con Pinecone
pc = Pinecone(api_key=settings.PINECONE_API_KEY)

# ATENCIÓN: Ahora coge el nombre del índice correctamente desde tu .env
index = pc.Index(settings.PINECONE_INDEX_NAME)

# Modelo de embeddings nativo de Pinecone (1024 dimensiones)
PINECONE_MODEL = "llama-text-embed-v2"

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
    if not chunks:
        return 0

    # Pinecone transforma TODOS los trozos en vectores de golpe
    embedding_response = pc.inference.embed(
        model=PINECONE_MODEL,
        inputs=chunks,
        parameters={"input_type": "passage", "truncate": "END"}
    )

    vectors = []
    for i, embedding_data in enumerate(embedding_response.data):
        chunk_id = f"{comunidad_id}-{document_title}-{i}"
        
        vectors.append({
            "id": chunk_id,
            "values": embedding_data.values, # Genera los 1024 números
            "metadata": {
                "comunidad_id": comunidad_id,
                "document_title": document_title,
                "chunk_index": i,
                "texto": chunks[i]
            }
        })

    # Subimos todos los vectores a Pinecone
    if vectors:
        index.upsert(
            vectors=vectors,
            namespace=str(comunidad_id),
        )

    return len(vectors)