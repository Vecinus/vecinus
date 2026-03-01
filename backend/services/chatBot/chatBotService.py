from google import genai
from pinecone import Pinecone
from backend.core.config import settings
from backend.services.chatBot.documents_ChatBotService import index, PINECONE_MODEL

# Inicializamos clientes
client = genai.Client(api_key=settings.GEMINI_API_KEY)
pc = Pinecone(api_key=settings.PINECONE_API_KEY)

MODEL_NAME = "gemini-1.5-flash"
CONFIDENCE_THRESHOLD = 0.2  # Umbral relajado al 20% para asegurar que pille textos cortos

DISCLAIMER = (
    "Esta respuesta es meramente informativa y se basa en la normativa general "
    "sobre comunidades de propietarios. No sustituye el asesoramiento legal "
    "profesional. Para decisiones importantes, consulta con un abogado o con el "
    "administrador de la comunidad."
)

def _retrieve_relevant_chunks(comunidad_id: int, question, top_k=5):
    # Embebemos la pregunta usando Pinecone (1024 dimensiones)
    embedding_response = pc.inference.embed(
        model=PINECONE_MODEL,
        inputs=[question],
        parameters={"input_type": "query"}
    )
    question_vector = embedding_response.data[0].values

    # Buscamos en la base de datos
    res = index.query(
        namespace=str(comunidad_id),
        vector=question_vector,
        top_k=top_k,
        include_metadata=True
    )

    # Extraemos el texto
    top_chunks = []
    for match in res.get("matches", []):
        score = match.get("score", 0.0)
        metadata = match.get("metadata") or {}
        text = metadata.get("texto", "")
        document_title = metadata.get("document_title", "")
        chunk_index = metadata.get("chunk_index", 0)

        print(f"[DEBUG] Documento: {document_title} | Score: {score:.4f} | Threshold: {CONFIDENCE_THRESHOLD}")

        if score > CONFIDENCE_THRESHOLD:
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
    system_instruction = """Eres el asistente de una comunidad de vecinos.

Debes responder a la pregunta del usuario utilizando ÚNICAMENTE la información 
proporcionada en los documentos. 

REGLA DE CONTRADICCIONES: Si encuentras información contradictoria entre varios documentos, NO digas que no tienes la información. En su lugar, explica amablemente que hay una contradicción, detalla cuáles son las distintas opciones que has encontrado y menciona de qué documento proviene cada una.

Si la información no aparece en absoluto en los documentos, responde exactamente: "No he encontrado esta información en los documentos actuales."

Sé claro, conciso y útil."""

    user_message = f"""DOCUMENTOS DISPONIBLES:

{context}

---

PREGUNTA DEL USUARIO: {question}

Por favor, responde usando SOLO la información de los documentos anteriores."""

    resp = client.models.generate_content(
        model=MODEL_NAME,
        contents=user_message,
        config={"system_instruction": system_instruction}
    )

    if not resp or not getattr(resp, "text", None):
        return "Ha ocurrido un problema al generar la respuesta."

    return resp.text.strip()

def get_chatbot_response(comunidad_id, question):
    print(f"\n[DEBUG] Pregunta: {question}")
    chunks = _retrieve_relevant_chunks(comunidad_id, question)
    
    print(f"[DEBUG] Chunks encontrados: {len(chunks)}")

    if not chunks:
        answer = "Lo siento, no puedo encontrar ningún documento relevante en esta comunidad."
        return {
            "answer": answer,
            "source": {"type": "RAG_PINECONE", "reference": None},
            "disclaimer": DISCLAIMER,
        }
    
    context = _build_context(chunks)
    answer = _ask_gemini_with_context(context, question)

    sources = list(set([c["document_title"] for c in chunks if c["document_title"]]))

    return {
        "answer": answer,
        "source": {"type": "RAG_PINECONE", "reference": ", ".join(sources)},
        "disclaimer": DISCLAIMER,
    }