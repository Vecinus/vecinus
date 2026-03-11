import os
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

# Dummy env vars before importing app
os.environ["SUPABASE_URL"] = "http://localhost:8000"
os.environ["SUPABASE_KEY"] = "dummy"
os.environ["SUPABASE_SERVICE_KEY"] = "dummy"
os.environ["SUPABASE_SCHEMA"] = "public"

from api.chatBot import chatBot as chatbot_router_module  # noqa: E402
from core.deps import get_current_user, get_supabase  # noqa: E402
from main import app  # noqa: E402
from services.chatBot.chatBotService import DISCLAIMER  # noqa: E402

client = TestClient(app)

COMMUNITY_ID = "1"
USER_ADMIN_ID = str(uuid4())
USER_NON_ADMIN_ID = str(uuid4())


class MockSupabaseTable:
    def __init__(self, data):
        self._data = data

    def select(self, *args, **kwargs):
        return self

    def eq(self, column, value, **kwargs):
        self._data = [row for row in self._data if str(row.get(column)) == str(value)]
        return self

    def execute(self):
        class MockResponse:
            def __init__(self, data):
                self.data = data

        return MockResponse(self._data)


class MockSupabaseClient:
    def __init__(self):
        self._memberships = [
            {"association_id": COMMUNITY_ID, "profile_id": USER_ADMIN_ID, "role": 1},
            {"association_id": COMMUNITY_ID, "profile_id": USER_NON_ADMIN_ID, "role": 2},
        ]

    def table(self, name: str):
        if name == "memberships":
            return MockSupabaseTable(self._memberships.copy())
        return MockSupabaseTable([])


def override_get_current_user_admin():
    return {"id": USER_ADMIN_ID, "role": "authenticated", "email": "admin@test.com"}


def override_get_supabase():
    return MockSupabaseClient()


@pytest.fixture(autouse=True)
def setup_overrides():
    app.dependency_overrides[get_current_user] = override_get_current_user_admin
    app.dependency_overrides[get_supabase] = override_get_supabase
    yield
    app.dependency_overrides.clear()


# Helpers para mocks de Pinecone y Gemini


def _make_mock_embedding(dim=768):
    embedding = MagicMock()
    embedding.values = [0.1] * dim
    response = MagicMock()
    response.embeddings = [embedding]
    return response


def _make_mock_gemini_client(llm_answer=""):
    mock_client = MagicMock()
    mock_client.models.embed_content.return_value = _make_mock_embedding()

    mock_llm_response = MagicMock()
    mock_llm_response.text = llm_answer
    mock_client.aio.models.generate_content = AsyncMock(return_value=mock_llm_response)
    return mock_client


def _make_mock_pinecone_index(matches=None):
    mock_index = MagicMock()
    mock_index.query.return_value = {"matches": matches or []}
    mock_index.upsert.return_value = None
    return mock_index


def test_chatbot_pregunta_vacia_devuelve_400():
    payload = {"comunidad_id": COMMUNITY_ID, "question": "   "}
    response = client.post(f"/comunities/{COMMUNITY_ID}/chatbot", json=payload)

    assert response.status_code == 400
    assert response.json()["detail"] == "La pregunta no puede estar vacia."


def test_chatbot_pregunta_irrelevante_devuelve_fallback():
    payload = {
        "comunidad_id": COMMUNITY_ID,
        "question": "Como se cocina una buena paella valenciana?",
    }

    low_score_matches = [{"score": 0.3, "metadata": {"texto": "Texto irrelevante", "document_title": "doc.pdf"}}]

    with patch(
        "services.chatBot.chatBotService._get_index",
        return_value=_make_mock_pinecone_index(low_score_matches),
    ), patch(
        "services.chatBot.chatBotService._get_client",
        return_value=_make_mock_gemini_client(),
    ):
        response = client.post(f"/comunities/{COMMUNITY_ID}/chatbot", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "no he encontrado" in data["answer"].lower()
        assert data["source"]["reference"] is None
        assert data["disclaimer"] == DISCLAIMER


def test_chatbot_documento_ya_existente():
    payload = {
        "comunidad_id": COMMUNITY_ID,
        "question": "A que hora cierra la piscina en verano?",
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
        return_value=_make_mock_gemini_client(llm_answer="La piscina cierra a las 22:00 en verano."),
    ):
        response = client.post(f"/comunities/{COMMUNITY_ID}/chatbot", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert "22" in data["answer"]
        assert data["source"]["reference"] == "Estatutos.pdf"
        assert data["disclaimer"] == DISCLAIMER


def test_chatbot_flujo_completo_con_subida_documento_admin():
    texto_archivo = "El nuevo presidente es Don Gato del 4B. La clave del candado es 7788."
    archivos = {
        "file": (
            "Acta_Secreta.txt",
            texto_archivo.encode("utf-8"),
            "text/plain",
        ),
    }

    mock_pinecone = _make_mock_pinecone_index(
        [{"score": 0.95, "metadata": {"texto": texto_archivo, "document_title": "Acta_Secreta.txt"}}]
    )
    mock_gemini = _make_mock_gemini_client(llm_answer="El presidente es Don Gato y la clave es 7788.")

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
        upload_response = client.post(f"/comunities/{COMMUNITY_ID}/documents", files=archivos)
        assert upload_response.status_code == 200
        upload_data = upload_response.json()
        assert "indexado con" in upload_data["message"].lower()
        assert upload_data["chunks"] > 0
        assert upload_data["uploaded_by"] == USER_ADMIN_ID

        upsert_payload = mock_pinecone.upsert.call_args.kwargs["vectors"][0]["metadata"]
        assert upsert_payload["uploaded_by"] == USER_ADMIN_ID
        assert upsert_payload["uploaded_by_email"] == "admin@test.com"
        assert upsert_payload["source_filename"] == "Acta_Secreta.txt"
        assert upsert_payload["uploaded_at"]

        chat_payload = {
            "comunidad_id": COMMUNITY_ID,
            "question": "Quien es el nuevo presidente y cual es la clave?",
        }
        chat_response = client.post(f"/comunities/{COMMUNITY_ID}/chatbot", json=chat_payload)
        assert chat_response.status_code == 200
        data = chat_response.json()
        respuesta = data["answer"].lower()

        assert "no he encontrado" not in respuesta
        assert "gato" in respuesta
        assert "7788" in respuesta
        assert "Acta_Secreta.txt" in data["source"]["reference"]


def test_upload_documento_no_admin_devuelve_403():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": USER_NON_ADMIN_ID,
        "role": "authenticated",
        "email": "owner@test.com",
    }

    archivos = {
        "file": (
            "normas.txt",
            b"Reglas de la comunidad",
            "text/plain",
        ),
    }

    response = client.post(f"/comunities/{COMMUNITY_ID}/documents", files=archivos)
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required for this action"


def test_chatbot_no_envia_historial_al_backend():
    payload = {"comunidad_id": COMMUNITY_ID, "question": "Primera pregunta"}

    with patch(
        "api.chatBot.chatBot.get_chatbot_response",
        new=AsyncMock(
            return_value={
                "answer": "Respuesta",
                "source": {"type": "RAG_PINECONE", "reference": None},
                "disclaimer": DISCLAIMER,
            }
        ),
    ) as mocked_response:
        response = client.post(f"/comunities/{COMMUNITY_ID}/chatbot", json=payload)
        assert response.status_code == 200

        args = mocked_response.await_args.args
        kwargs = mocked_response.await_args.kwargs

        if len(args) >= 3:
            assert args[2] is None
        else:
            assert kwargs.get("history") is None


def test_listar_documentos_comunidad():
    mocked_response = {
        "documents": [
            {
                "document_title": "prueba.txt",
                "source_filename": "prueba.txt",
                "uploaded_by": USER_ADMIN_ID,
                "uploaded_by_email": "admin@test.com",
                "uploaded_at": "2026-03-08T12:00:00+00:00",
                "chunks": 3,
            }
        ],
        "namespace": COMMUNITY_ID,
        "vector_count": 3,
        "queried_vectors": 3,
        "truncated": False,
    }

    with patch("api.chatBot.documents.list_documents", return_value=mocked_response) as mocked_list:
        response = client.get(f"/comunities/{COMMUNITY_ID}/documents")
        assert response.status_code == 200
        data = response.json()
        assert data["documents"][0] == "prueba.txt"
        mocked_list.assert_called_once_with(COMMUNITY_ID, uploaded_by=None, limit=100)


def test_borrar_documento_admin():
    mocked_delete_response = {
        "deleted_chunks": 2,
        "namespace": COMMUNITY_ID,
        "document_title": "prueba.txt",
    }

    with patch("api.chatBot.documents.delete_document", return_value=mocked_delete_response) as mocked_delete:
        response = client.delete(f"/comunities/{COMMUNITY_ID}/documents?document_title=prueba.txt")
        assert response.status_code == 200
        data = response.json()
        assert data["deleted_chunks"] == 2
        assert "eliminado" in data["message"].lower()
        mocked_delete.assert_called_once_with(COMMUNITY_ID, "prueba.txt")


def test_borrar_documento_no_admin_devuelve_403():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": USER_NON_ADMIN_ID,
        "role": "authenticated",
        "email": "owner@test.com",
    }

    response = client.delete(f"/comunities/{COMMUNITY_ID}/documents?document_title=prueba.txt")
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required for this action"


def test_listar_documentos_no_admin_devuelve_403():
    app.dependency_overrides[get_current_user] = lambda: {
        "id": USER_NON_ADMIN_ID,
        "role": "authenticated",
        "email": "owner@test.com",
    }

    response = client.get(f"/comunities/{COMMUNITY_ID}/documents")
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin access required for this action"
