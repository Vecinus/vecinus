import io

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor
from schemas.transcription.minutes import MinutesResponse


class DocumentService:
    @staticmethod
    def _apply_style(obj, size_pt=11, bold=False, color=None):
        """Aplica estilo de forma segura a un objeto Heading o Paragraph."""
        if not obj:
            return
        # Iteramos sobre los runs. Si no hay runs, creamos uno.
        runs = obj.runs if hasattr(obj, "runs") and obj.runs else [obj.add_run()]
        for run in runs:
            """ESTILO DEL DOCUMENTO"""
            run.font.name = "Calibri"
            run.font.size = Pt(size_pt)
            run.font.bold = bold
            if color:
                run.font.color.rgb = color

    @staticmethod
    def add_heading(doc: Document, text: str, level: int = 1):
        """Añade un encabezado con estilo asegurando que el texto no sea None."""
        text_str = str(text) if text is not None else ""
        heading = doc.add_heading(text_str, level=level)
        DocumentService._apply_style(heading, size_pt=14 if level == 1 else 12, color=RGBColor(0x1A, 0x1A, 0x2E))
        return heading

    @staticmethod
    def add_styled_paragraph(doc: Document, text: str, style: str = None):
        """Añade un párrafo asegurando que el texto no sea None."""
        text_str = str(text) if text is not None else ""
        paragraph = doc.add_paragraph(text_str, style=style)
        DocumentService._apply_style(paragraph, size_pt=11)
        return paragraph

    @staticmethod
    def generate_docx(minutes: MinutesResponse) -> io.BytesIO:
        """Recibe un objeto MinutesResponse (DTO) y devuelve un buffer de Word."""
        doc = Document()

        # Título principal
        title = doc.add_heading("Acta de Reunión", level=0)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER

        # Metadatos
        f_date = minutes.scheduled_at.strftime("%d/%m/%Y %H:%M")
        location = minutes.location

        metadata_parag = doc.add_paragraph()
        metadata_parag.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = metadata_parag.add_run(f"Fecha de generación: {f_date} | Ubicación: {location}")
        run.font.size = Pt(10)
        run.font.italic = True

        # Secciones - Uso correcto de métodos estáticos
        DocumentService.add_heading(doc, "Resumen", level=1)
        DocumentService.add_styled_paragraph(doc, minutes.summary)

        DocumentService.add_heading(doc, "Temas Tratados", level=1)
        for topic in minutes.topics:
            DocumentService.add_styled_paragraph(doc, topic, style="List Bullet")

        DocumentService.add_heading(doc, "Acuerdos Alcanzados", level=1)
        for agreement in minutes.agreements:
            agreement_text = f"{agreement.description} Resultado: {agreement.result.value}"
            DocumentService.add_styled_paragraph(doc, agreement_text, style="List Bullet")

        DocumentService.add_heading(doc, "Tareas Asignadas", level=1)
        if minutes.tasks:
            table = doc.add_table(rows=1, cols=3)
            table.style = "Table Grid"

            header_cells = table.rows[0].cells
            headers = ["Responsable", "Descripción", "Plazo"]
            for i, header_text in enumerate(headers):
                header_cells[i].text = header_text
                for paragraph in header_cells[i].paragraphs:
                    for run in paragraph.runs:
                        run.bold = True
                        run.font.size = Pt(10)
                        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
                from docx.oxml.ns import qn

                shading = header_cells[i]._element.get_or_add_tcPr()
                shading_elm = shading.makeelement(
                    qn("w:shd"),
                    {
                        qn("w:fill"): "1A1A2E",
                        qn("w:val"): "clear",
                    },
                )
                shading.append(shading_elm)

            for task in minutes.tasks:
                row_cells = table.add_row().cells
                row_cells[0].text = task.responsible
                row_cells[1].text = task.description
                row_cells[2].text = task.deadline
                for cell in row_cells:
                    for paragraph in cell.paragraphs:
                        for run in paragraph.runs:
                            run.font.size = Pt(10)

        DocumentService.add_heading(doc, "Transcripción Completa", level=1)
        DocumentService.add_styled_paragraph(doc, minutes.transcription)

        buffer = io.BytesIO()
        doc.save(buffer)
        buffer.seek(0)
        return buffer
