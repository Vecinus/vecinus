import asyncio
import time

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


LLM_MODEL = "gemini-2.5-flash"
EMBEDDING_MODEL = "gemini-embedding-001"

CONFIDENCE_THRESHOLD = 0.6
CONTEXT_LIMIT = 3000

DISCLAIMER = "Respuesta meramente informativa basada en estatutos. No sustituye asesoramiento legal."


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

    print(f"\n[DEBUG RAG] Busqueda para comunidad_id: {namespace}")
    print(f"[DEBUG RAG] Pregunta: {question}")
    print(f"[DEBUG RAG] Resultados encontrados: {len(matches)}")

    if matches:
        print(f"[DEBUG RAG] Score mas alto: {matches[0].get('score', 0.0):.4f}")
        print(f"[DEBUG RAG] Threshold configurado: {CONFIDENCE_THRESHOLD}")
        for i, match in enumerate(matches, 1):
            score = match.get("score", 0.0)
            doc_title = match.get("metadata", {}).get("document_title", "unknown")
            print(f"[RAG]Match {i}: score={score:.4f} doc='{doc_title}' pasa_threshold={score > CONFIDENCE_THRESHOLD}")
    else:
        print(f"[DEBUG RAG] No se encontraron vectores en el namespace '{namespace}'")

    valid_chunks = [match for match in matches if match.get("score", 0.0) > CONFIDENCE_THRESHOLD]

    if not valid_chunks:
        print(f"[DEBUG RAG] Ningun resultado supera el threshold de {CONFIDENCE_THRESHOLD}")
        return []

    valid_chunks = sorted(valid_chunks, key=lambda x: x["score"], reverse=True)[:2]

    print(f"[DEBUG RAG] Usando {len(valid_chunks)} chunks validos")

    return [
        {
            "text": c["metadata"]["texto"],
            "document_title": c["metadata"]["document_title"],
        }
        for c in valid_chunks
    ]


# Reintentos para errores transitorios de Gemini (503, 429)
_LLM_MAX_RETRIES = 3
_LLM_RETRY_BASE_DELAY = 4  # segundos


def _format_history(history: list[dict[str, str]] | None) -> str:
    if not history:
        return "Sin historial previo."

    valid_messages = [m for m in history if m.get("role") in {"user", "assistant"} and m.get("content")]
    if not valid_messages:
        return "Sin historial previo."

    return "\n".join([f"{m['role']}: {m['content']}" for m in valid_messages])


async def _ask_gemini_with_timeout(context: str, question: str, history: list[dict[str, str]] | None = None):
    system_instruction = (
        "Eres el asistente de una comunidad de vecinos."
        "\n\nDebes responder a la pregunta del usuario "
        "utilizando UNICAMENTE la informacion "
        "proporcionada en los documentos."
        "\n\nREGLA DE CONTRADICCIONES: Si encuentras "
        "informacion contradictoria entre varios "
        "documentos, NO digas que no tienes la "
        "informacion. En su lugar, explica amablemente "
        "que hay una contradiccion, detalla cuales son "
        "las distintas opciones que has encontrado y "
        "menciona de que documento proviene cada una."
        "\n\nSi la informacion no aparece en absoluto "
        "en los documentos, responde exactamente: "
        "No he encontrado esta informacion en los "
        "documentos actuales."
        "\n\nSe claro, conciso y util."
    )

    history_text = _format_history(history)
    user_message = f"HISTORIAL:\n{history_text}\n\nDOCUMENTOS:\n{context}\n\nPREGUNTA: {question}"

    for attempt in range(_LLM_MAX_RETRIES):
        try:
            resp = await asyncio.wait_for(
                _get_client().aio.models.generate_content(
                    model=LLM_MODEL,
                    contents=user_message,
                    config={"system_instruction": system_instruction},
                ),
                timeout=30.0,
            )
            return resp.text.strip()
        except asyncio.TimeoutError:
            if attempt < _LLM_MAX_RETRIES - 1:
                delay = _LLM_RETRY_BASE_DELAY * (2**attempt)
                print(f"[RETRY] Gemini timeout, reintentando en {delay}s...")
                time.sleep(delay)
                continue
            return "El servicio está tardando demasiado. Por favor, inténtalo de nuevo en unos segundos."
        except Exception as e:
            error_str = str(e).lower()
            is_transient = any(kw in error_str for kw in ("503", "unavailable", "overloaded", "429", "rate"))
            if is_transient and attempt < _LLM_MAX_RETRIES - 1:
                delay = _LLM_RETRY_BASE_DELAY * (2**attempt)
                print(f"[RETRY] Gemini error transitorio ({e}), reintentando en {delay}s...")
                time.sleep(delay)
                continue
            print(f"[ERROR] Fallo en Gemini: {e}")
            return "El servicio de IA está temporalmente saturado."
    try:
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
        return "El servicio esta tardando demasiado. Por favor, intentalo de nuevo en unos segundos."
    except Exception as e:
        print(f"[ERROR] Fallo en Gemini: {e}")
        return "El servicio de IA esta temporalmente saturado."


async def get_chatbot_response(
    comunidad_id: str,
    question: str,
    history: list[dict[str, str]] | None = None,
):
    chunks = _retrieve_and_rerank(comunidad_id, question)

    if not chunks:
        return {
            "answer": "No he encontrado esta informacion en los estatutos o normas de la comunidad.",
            "source": {
                "type": "RAG_PINECONE",
                "reference": None,
            },
            "disclaimer": DISCLAIMER,
        }

    raw_context = "\n\n".join([c["text"] for c in chunks])
    context = raw_context[:CONTEXT_LIMIT]

    answer = await _ask_gemini_with_timeout(context, question, history)
    sources = list({c["document_title"] for c in chunks})

    return {
        "answer": answer,
        "source": {"type": "RAG_PINECONE", "reference": ", ".join(sources)},
        "disclaimer": DISCLAIMER,
    }
