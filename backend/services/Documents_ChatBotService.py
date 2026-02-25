import google.generativeai as genai
import backend.core.config as settings

genai.configure(api_key=settings.GEMINI_API_KEY)

EMBEDDING_MODEL = "text-embedding-004"  # GEMINI_EMBEDDING_MODEL

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
    embeding = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=text,
        task_type="retrieval_query",
    )
    return embeding["embedding"]

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
                text: chunk,
                "embedding": embedding,
            }
        )
        strored += 1
    
    return stored