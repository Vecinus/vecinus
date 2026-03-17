import io

from docx import Document
from schemas.transcription.minutes import MinutesResponse, Task

from backend.services.transcription.document_service import DocumentService


def test_docx_generation_integrity():
    # Datos de entrada
    mock_data = MinutesResponse(
        transcription="Texto de prueba",
        summary="Resumen de prueba",
        topics=["Tema 1"],
        agreements=["Acuerdo 1"],
        tasks=[Task(responsible="Yo", description="Test", deadline="Pronto")],
    )

    buffer = DocumentService.generate_docx(mock_data)

    # Validaciones físicas del archivo
    if not isinstance(buffer, io.BytesIO):
        raise AssertionError(
            "Tipo de salida incorrecto." + f"Se esperaba io.BytesIO pero se obtuvo {type(buffer).__name__}"
        )
    doc = Document(buffer)

    # Verificamos que el título esté presente
    texts = [p.text for p in doc.paragraphs]
    target_title = "Acta de Reunión"
    if target_title not in texts:
        raise AssertionError(
            f"El título '{target_title}' no se encontró en el documento generado." f"Textos detectados: {texts}"
        )

    # Verificar que la tabla de tareas se creó (mínimo 2 filas: cabecera + 1 tarea)
    num_tablas = len(doc.tables)
    if num_tablas <= 0:
        raise AssertionError("Fallo en la estructura:" + "El documento generado no contiene ninguna tabla.")

    num_filas = len(doc.tables[0].rows)
    if num_filas != 2:
        raise AssertionError(
            "Contenido de tabla incorrecto. " + f"Se esperaban 2 filas (cabecera + tarea), pero hay {num_filas}"
        )
