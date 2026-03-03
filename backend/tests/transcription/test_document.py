import io

from docx import Document
from schemas.transcription.minutes import MinutesResponse, Task
from services.document_service import generate_docx


def test_docx_generation_integrity():
    # Datos de entrada
    mock_data = MinutesResponse(
        transcription="Texto de prueba",
        summary="Resumen de prueba",
        topics=["Tema 1"],
        agreements=["Acuerdo 1"],
        tasks=[Task(responsible="Yo", description="Test", deadline="Pronto")],
    )

    buffer = generate_docx(mock_data)

    # Validaciones físicas del archivo
    assert isinstance(buffer, io.BytesIO)
    doc = Document(buffer)

    # Verificamos que el título esté presente
    texts = [p.text for p in doc.paragraphs]
    assert "Acta de Reunión" in texts

    # Verificar que la tabla de tareas se creó (mínimo 2 filas: cabecera + 1 tarea)
    assert len(doc.tables) > 0
    assert len(doc.tables[0].rows) == 2
