import io
from typing import Optional

import pypdf
from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from backend.services.chatBot.documents_ChatBotService import index_document

router = APIRouter(prefix="/comunities", tags=["documents"])


@router.post("/{comunidad_id}/documents")
async def upload_document(
    comunidad_id: int,
    request: Request,
    file: Optional[UploadFile] = File(None),
):
    content_type = request.headers.get("content-type", "")

    # CASO 1: Si es un JSON (Tests antiguos)
    if "application/json" in content_type:
        data = await request.json()
        title = data.get("title")
        content = data.get("content")

        if not title or not content:
            raise HTTPException(
                status_code=400,
                detail="Faltan campos 'title' o 'content' en el JSON.",
            )
        chunks = index_document(comunidad_id, title, content)
        return {
            "message": f"Documento '{title}' indexado con éxito",
            "chunks": chunks,
        }

    # CASO 2: Si es un Archivo Físico (PDF o TXT)
    elif "multipart/form-data" in content_type:
        if not file:
            raise HTTPException(
                status_code=400, detail="No se ha enviado un archivo válido."
            )

        texto_extraido = ""
        # Leer TXT
        if file.filename.endswith(".txt"):
            contenido_bytes = await file.read()
            texto_extraido = contenido_bytes.decode("utf-8")

        # Leer PDF
        elif file.filename.endswith(".pdf"):
            contenido_bytes = await file.read()
            lector_pdf = pypdf.PdfReader(io.BytesIO(contenido_bytes))
            for pagina in lector_pdf.pages:
                texto_pagina = pagina.extract_text()
                if texto_pagina:
                    texto_extraido += texto_pagina + "\n"
        else:
            raise HTTPException(
                status_code=400,
                detail="Formato no soportado." " Sube un .txt o .pdf",
            )

        if not texto_extraido.strip():
            raise HTTPException(
                status_code=400,
                detail=(
                    "El documento está vacío o" " no se pudo extraer el texto."
                ),
            )

        chunks = index_document(comunidad_id, file.filename, texto_extraido)
        return {
            "message": f"Documento '{file.filename}' indexado con éxito",
            "chunks": chunks,
        }

    else:
        raise HTTPException(
            status_code=400,
            detail="Content-Type no soportado." " Usa JSON o Form-Data.",
        )
