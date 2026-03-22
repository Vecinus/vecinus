import hashlib
from datetime import datetime, timezone

from core.config import settings

# Lazy singletons -- se crean la primera vez que se usan,
# no al importar el modulo (evita llamadas de red en tests).
_index = None
_client = None


def _get_index():
    global _index
    if _index is None:
        from pinecone import Pinecone

        pc = Pinecone(api_key=settings.PINECONE_API_KEY)
        _index = pc.Index(settings.PINECONE_INDEX_NAME)
    return _index


def _get_client():
    global _client
    if _client is None:
        from google import genai

        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


EMBEDDING_MODEL = "gemini-embedding-001"
MAX_LIST_QUERY = 500


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


def _normalize_namespace(comunidad_id) -> str:
    """Normaliza el id de comunidad para usarlo como namespace de Pinecone."""
    return str(comunidad_id).strip()


def _build_chunk_id(namespace: str, document_title: str, chunk_index: int) -> str:
    """
    Pinecone impone restricciones de longitud/formato en record IDs.
    Usamos hash estable para evitar fallos con ids largas o titulos complejos.
    """
    seed = f"{namespace}|{document_title}|{chunk_index}".encode("utf-8")
    digest = hashlib.sha256(seed).hexdigest()[:40]
    return f"chunk-{digest}"


def _get_list_query_vector():
    return (
        _get_client()
        .models.embed_content(
            model=EMBEDDING_MODEL,
            contents="Listado de documentos de la comunidad",
        )
        .embeddings[0]
        .values
    )


def index_document(
    comunidad_id,
    document_title,
    raw_text,
    uploaded_by: str | None = None,
    uploaded_by_email: str | None = None,
    source_filename: str | None = None,
):
    namespace = _normalize_namespace(comunidad_id)
    chunks = _chunk_text_with_overlap(raw_text)
    if not chunks:
        return 0

    uploaded_at = datetime.now(timezone.utc).isoformat()
    vectors = []
    for i, chunk_text in enumerate(chunks):
        chunk_id = _build_chunk_id(namespace, document_title, i)

        response = _get_client().models.embed_content(model=EMBEDDING_MODEL, contents=chunk_text)

        vectors.append(
            {
                "id": chunk_id,
                "values": response.embeddings[0].values,
                "metadata": {
                    "comunidad_id": namespace,
                    "document_title": document_title,
                    "source_filename": source_filename or document_title,
                    "chunk_index": i,
                    "uploaded_by": str(uploaded_by) if uploaded_by else None,
                    "uploaded_by_email": uploaded_by_email,
                    "uploaded_at": uploaded_at,
                    "texto": chunk_text,
                },
            }
        )

    if vectors:
        _get_index().upsert(
            vectors=vectors,
            namespace=namespace,
        )

    return len(vectors)


def list_documents(comunidad_id: str, uploaded_by: str | None = None, limit: int = 100):
    namespace = _normalize_namespace(comunidad_id)
    safe_limit = max(1, min(limit, MAX_LIST_QUERY))

    stats = _get_index().describe_index_stats()
    namespaces = stats.get("namespaces", {}) if isinstance(stats, dict) else {}
    vector_count = int(namespaces.get(namespace, {}).get("vector_count", 0))

    top_k = min(max(safe_limit * 20, 100), MAX_LIST_QUERY)
    query_kwargs = {
        "namespace": namespace,
        "vector": _get_list_query_vector(),
        "top_k": top_k,
        "include_metadata": True,
    }
    if uploaded_by:
        query_kwargs["filter"] = {"uploaded_by": {"$eq": str(uploaded_by)}}

    matches = _get_index().query(**query_kwargs).get("matches", [])

    documents_by_title = {}
    for match in matches:
        metadata = match.get("metadata", {})
        title = metadata.get("document_title") or "Documento sin titulo"
        current = documents_by_title.get(title)

        if current is None:
            documents_by_title[title] = {
                "document_title": title,
                "source_filename": metadata.get("source_filename"),
                "uploaded_by": metadata.get("uploaded_by"),
                "uploaded_by_email": metadata.get("uploaded_by_email"),
                "uploaded_at": metadata.get("uploaded_at"),
                "chunks": 1,
            }
            continue

        current["chunks"] += 1

        current_uploaded_at = current.get("uploaded_at") or ""
        new_uploaded_at = metadata.get("uploaded_at") or ""
        if new_uploaded_at > current_uploaded_at:
            current["uploaded_at"] = metadata.get("uploaded_at")
            current["uploaded_by"] = metadata.get("uploaded_by")
            current["uploaded_by_email"] = metadata.get("uploaded_by_email")

    documents = sorted(
        documents_by_title.values(),
        key=lambda doc: (doc.get("uploaded_at") or "", doc.get("document_title") or ""),
        reverse=True,
    )[:safe_limit]

    return {
        "documents": documents,
        "namespace": namespace,
        "vector_count": vector_count,
        "queried_vectors": top_k,
        "truncated": len(matches) >= top_k,
    }


def delete_document(comunidad_id: str, document_title: str):
    namespace = _normalize_namespace(comunidad_id)
    title = str(document_title).strip()
    if not title:
        return {"deleted_chunks": 0, "namespace": namespace, "document_title": title}

    deleted_chunks = 0
    query_vector = _get_list_query_vector()

    while True:
        matches = (
            _get_index()
            .query(
                namespace=namespace,
                vector=query_vector,
                top_k=MAX_LIST_QUERY,
                include_metadata=False,
                filter={"document_title": {"$eq": title}},
            )
            .get("matches", [])
        )

        if not matches:
            break

        ids = [m.get("id") for m in matches if m.get("id")]
        if not ids:
            break

        _get_index().delete(namespace=namespace, ids=ids)
        deleted_chunks += len(ids)

        if len(ids) < MAX_LIST_QUERY:
            break

    return {
        "deleted_chunks": deleted_chunks,
        "namespace": namespace,
        "document_title": title,
    }
