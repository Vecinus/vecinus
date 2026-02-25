import google.generativeai as genai
import backend.services.Documents_ChatBotService as doc_service
import backend.core.config as settings
from supabase import create_client
import math

genai.configure(api_key=settings.GEMINI_API_KEY)

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

MODEL_NAME = "gemini-1.5-flash"

DISCLAIMER = (
    "Esta respuesta es meramente informativa y se basa en la normativa general "
    "sobre comunidades de propietarios. No sustituye el asesoramiento legal "
    "profesional. Para decisiones importantes, consulta con un abogado o con el "
    "administrador de la comunidad."
)

## Helpers

def _cosine_similarity(a, b):
    if len(a) != len(b):
        return 0.0
    
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return dot / (norm_a * norm_b)

def _retrieve_relevant_chunks(comunidad_id, question, top_k=5):
    if comunidad_id not in doc_service.MEMORY:
        return []
    question_embed = doc_service._embed_text(question)
    scored = []
    for chunk in doc_service.MEMORY[comunidad_id]:
        similarity = _cosine_similarity(question_embed, chunk["embedding"])
        scored.append((similarity, chunk))
    scored.sort(key=lambda x: x[0], reverse=True)

    top_chunks = [c for score,c in scored[:top_k] if score > 0.2]
    return top_chunks


def _build_context(chunks, max_chars = 6000):
    parts = []
    total = 0
    for c in chunks:
        t = c["texto"]
        if total + len(t) > max_chars:
            break
        parts.append(t)
        total += len(t)
    return "\n\n---\n\n".join(parts)

def _ask_gemini_with_context(context, question):
    model = genai.GenerativeModel(MODEL_NAME)

    system_prompt = f"""
    Eres el asistente de una comunidad de vecinos.

Debes responder a la pregunta del usuario utilizando ÚNICAMENTE la siguiente
información extraída de los documentos de esta comunidad:

{context}

Si la respuesta no está claramente en este texto, responde exactamente:
"No he encontrado esta información en los documentos actuales."
"""
    prompt = f"""{system_prompt}

Pregunta del vecino:
{question}

Respuesta:
"""

    resp = model.generate_content(prompt)

    if not resp or not getattr(resp, "text", None):
        return "Ha ocurrido un problema al generar la respuesta."

    return resp.text.strip()

## Principal function

def get_chatbot_response(comunidad_id, question, history=None):
    """
    1. Recupera chunks relevantes de los documentos de esa comunidad.
    2. Construye un contexto con esos chunks.
    3. Llama a Gemini con ese contexto + pregunta.
    """
    
    chunks = _retrieve_relevant_chunks(comunidad_id, question)

    if not chunks:
        answer = "Lo siento, no puedo encontrar ningún documento relevante en esta comunidad."
        return {
            "answer": answer,
            "source": {"type": "RAG_IN_MEMORY", "reference": None},
            "disclaimer": DISCLAIMER,
        }
    
    context = _build_context(chunks)

    answer = _ask_gemini_with_context(context, question)

    return {
        "answer": answer,
        "source": {"type": "RAG_IN_MEMORY", "reference": [c["chunk_id"] for c in chunks]},
        "disclaimer": DISCLAIMER,
    }