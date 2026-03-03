import time

import pytest  # noqa: F401
from fastapi.testclient import TestClient

from core.config import settings
from main import app

client = TestClient(app)


def test_variables_entorno_cargadas():
    """Verifica variables críticas antes de tests."""
    assert (
        settings.PINECONE_INDEX_NAME != ""
    ), "¡Error! El índice de Pinecone está vacío."
    assert (
        settings.GEMINI_API_KEY != ""
    ), "¡Error! La API Key de Gemini está vacía."
    print(f"\n[OK] Apuntando al índice: " f"{settings.PINECONE_INDEX_NAME}")


# ==========================================
# 🛑 PRUEBAS NEGATIVAS (Lo que NO debe funcionar)
# ==========================================


def test_chatbot_pregunta_vacia_devuelve_400():
    """PRUEBA NEGATIVA 1: Pregunta vacía debe ser rechazada inmediatamente"""
    comunidad_id = 1
    payload = {
        "comunidad_id": str(comunidad_id),
        "question": "   ",
    }

    response = client.post(f"/comunities/{comunidad_id}/chatbot", json=payload)

    assert response.status_code == 400
    assert response.json()["detail"] == "La pregunta no puede estar vacía."


def test_chatbot_pregunta_irrelevante_devuelve_fallback():
    """PRUEBA NEGATIVA 2: Pregunta fuera de contexto"""
    comunidad_id = 1
    payload = {
        "comunidad_id": str(comunidad_id),
        "question": "¿Cómo se cocina una buena paella valenciana?",
    }

    response = client.post(
        f"/comunities/{comunidad_id}/chatbot",
        json=payload,
    )
    assert response.status_code == 200

    data = response.json()
    respuesta = data["answer"].lower()

    # Debe saltar el threshold de Pinecone
    assert (
        "no he encontrado" in respuesta
        or "no aparece en los estatutos" in respuesta
        or "no puedo encontrar" in respuesta
    )


# ==========================================
# ✅ PRUEBAS POSITIVAS (Lo que SÍ debe funcionar)
# ==========================================


def test_chatbot_documento_ya_existente():
    """PRUEBA POSITIVA 1: Preguntar sobre documento existente"""
    comunidad_id = 1
    payload = {
        "comunidad_id": str(comunidad_id),
        "question": "¿A qué hora cierra la piscina en verano?",
    }

    print("\n[+] Preguntando sobre documento " "ya existente (Comunidad 1)...")
    response = client.post(
        f"/comunities/{comunidad_id}/chatbot",
        json=payload,
    )

    assert response.status_code == 200
    data = response.json()

    print(f"\n[Respuesta IA]: {data['answer']}")

    # Comprobamos que la IA nos da el dato correcto (a las 23)
    assert "22" in data["answer"]


def test_chatbot_flujo_completo_con_subida_documento():
    """PRUEBA POSITIVA 2: Subir -> Esperar -> Preguntar"""
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
        )
    }

    print("\n[1/3] Subiendo documento a " "Pinecone (Comunidad 9999)...")
    upload_response = client.post(
        f"/comunities/{comunidad_test_id}/documents", files=archivos
    )
    assert upload_response.status_code == 200, (
        f"Error al subir documento: " f"{upload_response.text}"
    )

    # Pinecone necesita segundos para indexar
    print(
        "[2/3] Documento subido. Esperando 15s" " a que Pinecone lo indexe..."
    )
    time.sleep(15)

    chat_payload = {
        "comunidad_id": str(comunidad_test_id),
        "question": (
            "¿Quién es el nuevo presidente y" " cuál es la clave de las bicis?"
        ),
    }

    print("[3/3] Preguntando al Chatbot...")
    chat_response = client.post(
        f"/comunities/{comunidad_test_id}/chatbot", json=chat_payload
    )
    assert chat_response.status_code == 200, (
        f"Error en el chatbot: " f"{chat_response.text}"
    )

    data = chat_response.json()
    respuesta_ia = data["answer"].lower()

    print(f"\n[ÉXITO - Respuesta IA]: " f"{data['answer']}")
    print(f"[ÉXITO - Fuente]: " f"{data['source']['reference']}")

    # Comprobaciones de que la respuesta es exacta y no se inventa nada
    assert "no he encontrado" not in respuesta_ia
    assert "gato" in respuesta_ia
    assert "7788" in respuesta_ia
    assert "Acta_Secreta.txt" in data["source"]["reference"]
