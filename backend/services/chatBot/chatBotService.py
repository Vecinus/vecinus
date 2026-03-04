import asyncio

from core.config import settings

# Lazy singletons — se crean la primera vez que se usan,
# no al importar el módulo (evita llamadas de red en tests).
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


# Modelos exactos
LLM_MODEL = "gemini-2.5-flash"
EMBEDDING_MODEL = "gemini-embedding-001"

# Configuración del RAG
CONFIDENCE_THRESHOLD = 0.75
CONTEXT_LIMIT = 3000

DISCLAIMER = "Respuesta meramente informativa basada en estatutos." " No sustituye asesoramiento legal."


def _get_gemini_embedding(text: str):
    response = _get_client().models.embed_content(model=EMBEDDING_MODEL, contents=text)
    return response.embeddings[0].values


def _normalize_namespace(comunidad_id: str) -> str:
    return str(comunidad_id).strip()


def _retrieve_and_rerank(comunidad_id: str, question: str):
    namespace = _normalize_namespace(comunidad_id)
    query_vector = _get_gemini_embedding(question)

    res = _get_index().query(
        namespace=namespace,
        vector=query_vector,
        top_k=5,
        include_metadata=True,
    )

    matches = res.get("matches", [])

    # DEBUG: Imprimir información detallada
    print(f"\n[DEBUG RAG] Búsqueda para comunidad_id: {namespace}")
    print(f"[DEBUG RAG] Pregunta: {question}")
    print(f"[DEBUG RAG] Resultados encontrados: {len(matches)}")

    if matches:
        print(f"[DEBUG RAG] Score más alto: {matches[0].get('score', 0.0):.4f}")
        print(f"[DEBUG RAG] Threshold configurado: {CONFIDENCE_THRESHOLD}")
        for i, match in enumerate(matches, 1):
            score = match.get("score", 0.0)
            doc_title = match.get("metadata", {}).get("document_title", "unknown")
            print(
                f"[RAG]Match {i}: score={score:.4f} doc='{doc_title}' pasa_threshold={score > CONFIDENCE_THRESHOLD}"
            )
    else:
        print(f"[DEBUG RAG] ⚠️ No se encontraron vectores en el namespace '{namespace}'")

    valid_chunks = [match for match in matches if match.get("score", 0.0) > CONFIDENCE_THRESHOLD]

    if not valid_chunks:
        print(f"[DEBUG RAG] ❌ Ningún resultado supera el threshold de {CONFIDENCE_THRESHOLD}")
        return []

    # Nos quedamos con los 2 mejores para no saturar a Gemini
    valid_chunks = sorted(
        valid_chunks,
        key=lambda x: x["score"],
        reverse=True,
    )[:2]

    print(f"[DEBUG RAG] ✅ Usando {len(valid_chunks)} chunks válidos")

    return [
        {
            "text": c["metadata"]["texto"],
            "document_title": c["metadata"]["document_title"],
        }
        for c in valid_chunks
    ]


async def _ask_gemini_with_timeout(context: str, question: str):
    system_instruction = (
        "Eres el asistente de una comunidad de vecinos."
        "\n\nDebes responder a la pregunta del usuario "
        "utilizando ÚNICAMENTE la información "
        "proporcionada en los documentos."
        "\n\nREGLA DE CONTRADICCIONES: Si encuentras "
        "información contradictoria entre varios "
        "documentos, NO digas que no tienes la "
        "información. En su lugar, explica amablemente "
        "que hay una contradicción, detalla cuáles son "
        "las distintas opciones que has encontrado y "
        "menciona de qué documento proviene cada una."
        "\n\nSi la información no aparece en absoluto "
        "en los documentos, responde exactamente: "
        "No he encontrado esta información en los "
        "documentos actuales."
        "\n\nSé claro, conciso y útil."
    )

    user_message = f"DOCUMENTOS:\n{context}\n\nPREGUNTA: {question}"

    try:
        # Petición asíncrona con límite de tiempo
        resp = await asyncio.wait_for(
            _get_client().aio.models.generate_content(
                model=LLM_MODEL,
                contents=user_message,
                config={"system_instruction": system_instruction},
            ),
            timeout=15.0,
        )
        return resp.text.strip()
    except asyncio.TimeoutError:
        return "El servicio está tardando demasiado." " Por favor, inténtalo de nuevo en unos" " segundos."
    except Exception as e:
        print(f"[ERROR] Fallo en Gemini: {e}")
        return "El servicio de IA está temporalmente saturado."


async def get_chatbot_response(comunidad_id: str, question: str):
    chunks = _retrieve_and_rerank(comunidad_id, question)

    if not chunks:
        return {
            "answer": ("No he encontrado esta información" " en los estatutos o normas de la" " comunidad."),
            "source": {
                "type": "RAG_PINECONE",
                "reference": None,
            },
            "disclaimer": DISCLAIMER,
        }

    raw_context = "\n\n".join([c["text"] for c in chunks])
    context = raw_context[:CONTEXT_LIMIT]

    answer = await _ask_gemini_with_timeout(context, question)
    sources = list({c["document_title"] for c in chunks})

    return {
        "answer": answer,
        "source": {"type": "RAG_PINECONE", "reference": ", ".join(sources)},
        "disclaimer": DISCLAIMER,
    }
