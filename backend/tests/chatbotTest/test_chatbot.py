import pytest
import time
from fastapi.testclient import TestClient

from backend.main import app
from backend.core.config import settings

client = TestClient(app)

def test_poblar_datos_comunidad_1():
    """
    Script temporal para inyectar los datos de la piscina en la Comunidad 1 
    usando JSON para que los tests 3 y 4 tengan algo que leer.
    """
    comunidad_id = 1
    
    doc_payload = {
        "title": "Estatutos y Normas",
        "content": "Artículo 1. Horario de silencio. El horario de silencio será de 23:00 a 08:00 horas. Artículo 2. La piscina comunitaria abrirá todos los días a las 10:00 de la mañana y cerrará a las 22:00 de la noche."
    }
    
    print("\n[+] Poblando Comunidad 1 con JSON...")
    response = client.post(f"/comunities/{comunidad_id}/documents", json=doc_payload)
    assert response.status_code == 200
    
    print("[+] Datos subidos. Esperando 20s a que Pinecone los coloque...")
    time.sleep(20)

def test_variables_entorno_cargadas():
    assert settings.PINECONE_INDEX_NAME != "", "¡Error! El índice de Pinecone está vacío."
    assert settings.GEMINI_API_KEY != "", "¡Error! La API Key de Gemini está vacía."
    print(f"\n[OK] Apuntando al índice: {settings.PINECONE_INDEX_NAME}")

def test_chatbot_pregunta_vacia_devuelve_400():
    comunidad_id = 1
    payload = {"comunidad_id": str(comunidad_id), "question": "   "}
    response = client.post(f"/comunities/{comunidad_id}/chatbot", json=payload)
    assert response.status_code == 400
    assert response.json()["detail"] == "La pregunta no puede estar vacía."

def test_chatbot_flujo_completo_con_subida_documento():
    comunidad_test_id = 9999 
    
    texto_archivo = "El nuevo presidente de la comunidad para el año 2026 es el vecino Don Gato, del 4ºB. La clave del candado de las bicis es 7788."
    archivos = {"file": ("Acta_Secreta.txt", texto_archivo.encode("utf-8"), "text/plain")}
    
    print("\n[1/3] Subiendo documento a Pinecone...")
    upload_response = client.post(f"/comunities/{comunidad_test_id}/documents", files=archivos)
    assert upload_response.status_code == 200, f"Error al subir documento: {upload_response.text}"
    
    print("[2/3] Documento subido. Esperando 20 segundos a que Pinecone lo indexe...")
    time.sleep(20) 
    
    chat_payload = {
        "comunidad_id": str(comunidad_test_id),
        "question": "¿Quién es el nuevo presidente y cuál es la clave de las bicis?"
    }
    
    print("[3/3] Preguntando al Chatbot...")
    chat_response = client.post(f"/comunities/{comunidad_test_id}/chatbot", json=chat_payload)
    assert chat_response.status_code == 200, f"Error en el chatbot: {chat_response.text}"
    
    data = chat_response.json()
    
    print(f"\n[ÉXITO - Respuesta IA]: {data['answer']}")
    print(f"[ÉXITO - Fuente]: {data['source']['reference']}")
    
    assert "No he encontrado" not in data['answer']
    assert "Don Gato" in data['answer']
    assert "7788" in data['answer']
    assert "Acta_Secreta.txt" in data['source']['reference']