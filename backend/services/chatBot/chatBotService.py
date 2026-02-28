from google import genai


import backend.services.chatBot.documents_ChatBotService as doc_service
from backend.services.chatBot.documents_ChatBotService import index, _embed_content
from pinecone import Pinecone
from backend.core.config import settings
import math

# Inicializamos clientes
client = genai.Client(api_key=settings.GEMINI_API_KEY)

pc = Pinecone(api_key=settings.PINECONE_API_KEY)


MODEL_NAME = "gemini-2.5-flash"
PINECONE_MODEL = "llama-text-embed-v2" # El modelo que configurasteis en Pinecone

DISCLAIMER = (
    "Esta respuesta es meramente informativa y se basa en la normativa general "
    "sobre comunidades de propietarios. No sustituye el asesoramiento legal "
    "profesional. Para decisiones importantes, consulta con un abogado o con el "
    "administrador de la comunidad."
)


def _retrieve_relevant_chunks(comunidad_id: int, question, top_k=5):
    # 1. Pinecone transforma la pregunta en vectores automáticamente
    embedding_response = pc.inference.embed(
        model=PINECONE_MODEL,
        inputs=[question],
        parameters={"input_type": "query"}
    )
    question_vector = _embed_content(question)

    # 2. Buscamos en la base de datos solo los documentos de esta comunidad
    res = index.query(
        namespace=str(comunidad_id),
        vector=question_vector,
        top_k=top_k,
        include_metadata=True
    )

    # 3. Extraemos el texto de los resultados
    top_chunks = []
    for match in res.get("matches", []):
        score = match.get("score", 0.0)
        metadata = match.get("metadata") or {}
        text = metadata.get("texto", "")
        document_title = metadata.get("document_title", "")
        chunk_index = metadata.get("chunk_index", 0)

        if score > 0.2: # Filtro de confianza
            top_chunks.append({
                "text": text,
                "document_title": document_title,
                "chunk_index": chunk_index,
                "score": score
            })
    return top_chunks


def _build_context(chunks, max_chars = 6000):
    parts = []
    total = 0
    for c in chunks:
        t = c["text"]
        if total + len(t) > max_chars:
            break
        parts.append(t)
        total += len(t)
    return "\n\n---\n\n".join(parts)

def _ask_gemini_with_context(context, question):
    system_prompt = f"""
    Eres el asistente de una comunidad de vecinos.

    Debes responder a la pregunta del usuario utilizando ÚNICAMENTE la siguiente
    información extraída de los documentos de esta comunidad:

    {context}

    Si la respuesta no está claramente en este texto, responde exactamente:
    "No he encontrado esta información en los documentos actuales."

    Pregunta del vecino:
    {question}

    Respuesta:
    """

    resp = client.models.generate_content(
        model=MODEL_NAME,
        contents=system_prompt,
    )

    if not resp or not getattr(resp, "text", None):
        return "Ha ocurrido un problema al generar la respuesta."

    return resp.text.strip()

## Principal function

def get_chatbot_response(comunidad_id, question):
    chunks = _retrieve_relevant_chunks(comunidad_id, question)

    if not chunks:
        answer = "Lo siento, no puedo encontrar ningún documento relevante en esta comunidad."
        return {
            "answer": answer,
            "source": {"type": "RAG_PINECONE", "reference": None},
            "disclaimer": DISCLAIMER,
        }
    
    context = _build_context(chunks)
    answer = _ask_gemini_with_context(context, question)

    # Recopilamos los títulos de los documentos usados para las referencias
    sources = list(set([c["document_title"] for c in chunks if c["document_title"]]))

    return {
        "answer": answer,
        "source": {"type": "RAG_PINECONE", "reference": ", ".join(sources)},
        "disclaimer": DISCLAIMER,
    }