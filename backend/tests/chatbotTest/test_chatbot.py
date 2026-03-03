from unittest.mock import AsyncMock, MagicMock, patch

import pytest  # noqa: F401
from fastapi.testclient import TestClient
from main import app
from services.chatBot.chatBotService import DISCLAIMER

client = TestClient(app)


# ──────────────────────────────────────────────────────────────────────────────
# Helpers para crear mocks de Pinecone y Gemini
# ──────────────────────────────────────────────────────────────────────────────


def _make_mock_embedding(dim=768):
    """Simula la respuesta de Gemini embed_content."""
    embedding = MagicMock()
    embedding.values = [0.1] * dim
    response = MagicMock()
    response.embeddings = [embedding]
    return response


def _make_mock_gemini_client(llm_answer=""):
    """Crea un mock del cliente Gemini (embeddings + LLM async)."""
    mock_client = MagicMock()
    mock_client.models.embed_content.return_value = _make_mock_embedding()

    mock_llm_response = MagicMock()
    mock_llm_response.text = llm_answer
    mock_client.aio.models.generate_content = AsyncMock(
        return_value=mock_llm_response,
    )
    return mock_client


def _make_mock_pinecone_index(matches=None):
    """Crea un mock del índice Pinecone con resultados predefinidos."""
    mock_index = MagicMock()
    mock_index.query.return_value = {"matches": matches or []}
    mock_index.upsert.return_value = None
    return mock_index


# ──────────────────────────────────────────────────────────────────────────────
# PRUEBAS NEGATIVAS
# ──────────────────────────────────────────────────────────────────────────────


def test_chatbot_pregunta_vacia_devuelve_400():
    """PRUEBA NEGATIVA 1: Pregunta vacía debe ser rechazada inmediatamente"""
    comunidad_id = 1
    payload = {"comunidad_id": str(comunidad_id), "question": "   "}

    response = client.post(f"/comunities/{comunidad_id}/chatbot", json=payload)

    assert response.status_code == 400
    assert response.json()["detail"] == "La pregunta no puede estar vacía."


def test_chatbot_pregunta_irrelevante_devuelve_fallback():
    """PRUEBA NEGATIVA 2:Pregunta fuera de contexto: Pinecone devuelve scores bajos → fallback.

    Se ejecuta la lógica real de _retrieve_and_rerank: al estar todos los
    scores por debajo de CONFIDENCE_THRESHOLD, devuelve [] y
    get_chatbot_response retorna el mensaje de fallback.
    """
    comunidad_id = 1
    payload = {
        "comunidad_id": str(comunidad_id),
        "question": "¿Cómo se cocina una buena paella valenciana?",
    }

    low_score_matches = [
        {
            "score": 0.3,
            "metadata": {"texto": "Texto irrelevante", "document_title": "doc.pdf"},
        },
    ]

    with patch(
        "services.chatBot.chatBotService._get_index",
        return_value=_make_mock_pinecone_index(low_score_matches),
    ), patch(
        "services.chatBot.chatBotService._get_client",
        return_value=_make_mock_gemini_client(),
    ):
        response = client.post(
            f"/comunities/{comunidad_id}/chatbot",
            json=payload,
        )
        assert response.status_code == 200
        data = response.json()
        assert "no he encontrado" in data["answer"].lower()
        assert data["source"]["reference"] is None
        assert data["disclaimer"] == DISCLAIMER


# ──────────────────────────────────────────────────────────────────────────────
# PRUEBAS POSITIVAS
# ──────────────────────────────────────────────────────────────────────────────


def test_chatbot_documento_ya_existente():
    """PRUEBA POSITIVA 1: Preguntar sobre documento existente:
    Pinecone devuelve scores altos → se construye contexto → LLM responde.

    Se ejecuta la lógica real de _retrieve_and_rerank (filtra por threshold,
    ordena y extrae metadata) y get_chatbot_response (construye contexto,
    llama a Gemini LLM mock y formatea la respuesta).
    """
    comunidad_id = 1
    payload = {
        "comunidad_id": str(comunidad_id),
        "question": "¿A qué hora cierra la piscina en verano?",
    }

    high_score_matches = [
        {
            "score": 0.92,
            "metadata": {
                "texto": "La piscina comunitaria cierra a las 22:00 en verano.",
                "document_title": "Estatutos.pdf",
            },
        },
    ]

    with patch(
        "services.chatBot.chatBotService._get_index",
        return_value=_make_mock_pinecone_index(high_score_matches),
    ), patch(
        "services.chatBot.chatBotService._get_client",
        return_value=_make_mock_gemini_client(
            llm_answer="La piscina cierra a las 22:00 en verano.",
        ),
    ):
        response = client.post(
            f"/comunities/{comunidad_id}/chatbot",
            json=payload,
        )
        assert response.status_code == 200
        data = response.json()
        assert "22" in data["answer"]
        assert data["source"]["reference"] == "Estatutos.pdf"
        assert data["disclaimer"] == DISCLAIMER


def test_chatbot_flujo_completo_con_subida_documento():
    """PRUEBA POSITIVA 2: Subir documento (chunking real), esperar y preguntar (RAG pipeline real).

    - index_document ejecuta _chunk_text_with_overlap de verdad y genera
      embeddings con el mock de Gemini → valida la lógica de chunking.
    - get_chatbot_response ejecuta _retrieve_and_rerank de verdad con el
      mock de Pinecone → valida threshold, rerank y formateo de respuesta.
    """
    comunidad_test_id = 9999

    texto_archivo = (
        "El nuevo presidente de la comunidad para el "
        "año 2026 es el vecino Don Gato, del 4ºB. "
        "La clave del candado de las bicis es 7788."
    )
    archivos = {
        "file": (
            "Acta_Secreta.txt",
            texto_archivo.encode("utf-8"),
            "text/plain",
        ),
    }

    mock_pinecone = _make_mock_pinecone_index(
        [
            {
                "score": 0.95,
                "metadata": {
                    "texto": texto_archivo,
                    "document_title": "Acta_Secreta.txt",
                },
            },
        ]
    )
    mock_gemini = _make_mock_gemini_client(
        llm_answer="El presidente es Don Gato del 4ºB y la clave es 7788.",
    )

    with patch(
        "services.chatBot.documents_ChatBotService._get_index",
        return_value=mock_pinecone,
    ), patch(
        "services.chatBot.documents_ChatBotService._get_client",
        return_value=mock_gemini,
    ), patch(
        "services.chatBot.chatBotService._get_index",
        return_value=mock_pinecone,
    ), patch(
        "services.chatBot.chatBotService._get_client",
        return_value=mock_gemini,
    ):
        # 1. Subir documento — chunking real, embeddings mockeados
        upload_response = client.post(
            f"/comunities/{comunidad_test_id}/documents",
            files=archivos,
        )
        assert upload_response.status_code == 200
        upload_data = upload_response.json()
        assert "indexado con éxito" in upload_data["message"]
        assert upload_data["chunks"] > 0
        mock_pinecone.upsert.assert_called_once()

        # 2. Preguntar al chatbot — RAG pipeline real
        chat_payload = {
            "comunidad_id": str(comunidad_test_id),
            "question": "¿Quién es el nuevo presidente y cuál es la clave de las bicis?",
        }
        chat_response = client.post(
            f"/comunities/{comunidad_test_id}/chatbot",
            json=chat_payload,
        )
        assert chat_response.status_code == 200
        data = chat_response.json()
        respuesta = data["answer"].lower()

        assert "no he encontrado" not in respuesta
        assert "gato" in respuesta
        assert "7788" in respuesta
        assert "Acta_Secreta.txt" in data["source"]["reference"]
