import io
from typing import Optional

import pypdf
from api.chat.chat_helpers import verify_association_admin_or_president
from core.deps import get_current_user, get_supabase
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status
from pypdf.errors import PdfReadError
from services.chatBot.documents_ChatBotService import delete_document, index_document, list_documents
from supabase import Client

router = APIRouter(prefix="/comunities", tags=["documents"])

MAX_DOCUMENT_BYTES = 10 * 1024 * 1024
MAX_EXTRACTED_CHARS = 300_000
MAX_PDF_PAGES = 200
ALLOWED_DOCUMENT_EXTENSIONS = {".txt", ".pdf"}


async def read_upload_limited(file: UploadFile, max_bytes: int = MAX_DOCUMENT_BYTES) -> bytes:
    chunks = []
    total = 0
    while True:
        chunk = await file.read(1024 * 1024)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Documento demasiado grande"
            )
        chunks.append(chunk)
    return b"".join(chunks)


def validate_content_length(request: Request, max_bytes: int = MAX_DOCUMENT_BYTES) -> None:
    content_length = request.headers.get("content-length")
    if not content_length:
        return
    try:
        size = int(content_length)
    except ValueError:
        raise HTTPException(status_code=400, detail="Content-Length invalido")
    if size > max_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Documento demasiado grande")


def ensure_text_size(text: str) -> None:
    if len(text) > MAX_EXTRACTED_CHARS:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Contenido del documento demasiado grande"
        )


@router.get("/{comunidad_id}/documents")
async def get_documents(
    comunidad_id: str,
    uploaded_by: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    path_comunidad_id = str(comunidad_id).strip()
    verify_association_admin_or_president(path_comunidad_id, current_user["id"], supabase)
    result = list_documents(path_comunidad_id, uploaded_by=uploaded_by, limit=limit)
    documents = [doc.get("document_title") for doc in result.get("documents", []) if doc.get("document_title")]
    return {"documents": documents}


@router.post("/{comunidad_id}/documents")
async def upload_document(
    comunidad_id: str,
    request: Request,
    file: Optional[UploadFile] = File(None),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    path_comunidad_id = str(comunidad_id).strip()
    verify_association_admin_or_president(path_comunidad_id, current_user["id"], supabase)
    validate_content_length(request)
    content_type = request.headers.get("content-type", "")

    if "application/json" in content_type:
        data = await request.json()
        title = data.get("title")
        content = data.get("content")

        if not isinstance(title, str) or not isinstance(content, str) or not title.strip() or not content.strip():
            raise HTTPException(
                status_code=400,
                detail="Faltan campos 'title' o 'content' en el JSON.",
            )
        ensure_text_size(content)

        chunks = index_document(
            path_comunidad_id,
            title.strip(),
            content,
            uploaded_by=str(current_user["id"]),
            uploaded_by_email=current_user.get("email"),
            source_filename=title.strip(),
        )
        return {
            "message": f"Documento '{title}' indexado con exito",
            "chunks": chunks,
            "uploaded_by": str(current_user["id"]),
        }

    if "multipart/form-data" in content_type:
        if not file:
            raise HTTPException(status_code=400, detail="No se ha enviado un archivo valido.")

        texto_extraido = ""
        filename = file.filename or ""
        lower_filename = filename.lower()

        if not any(lower_filename.endswith(extension) for extension in ALLOWED_DOCUMENT_EXTENSIONS):
            raise HTTPException(status_code=415, detail="Formato no soportado. Sube un .txt o .pdf")

        contenido_bytes = await read_upload_limited(file)

        if lower_filename.endswith(".txt"):
            try:
                texto_extraido = contenido_bytes.decode("utf-8")
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="El archivo TXT debe estar codificado en UTF-8")
        elif lower_filename.endswith(".pdf"):
            try:
                lector_pdf = pypdf.PdfReader(io.BytesIO(contenido_bytes))
            except (PdfReadError, ValueError, OSError):
                raise HTTPException(status_code=400, detail="El PDF no se pudo leer correctamente")

            if len(lector_pdf.pages) > MAX_PDF_PAGES:
                raise HTTPException(status_code=413, detail="El PDF tiene demasiadas páginas")

            extracted_parts = []
            total_chars = 0
            for pagina in lector_pdf.pages:
                texto_pagina = pagina.extract_text() or ""
                if not texto_pagina:
                    continue
                total_chars += len(texto_pagina)
                if total_chars > MAX_EXTRACTED_CHARS:
                    raise HTTPException(status_code=413, detail="Contenido del documento demasiado grande")
                extracted_parts.append(texto_pagina)
            texto_extraido = "\n".join(extracted_parts)
        else:
            raise HTTPException(status_code=415, detail="Formato no soportado. Sube un .txt o .pdf")

        ensure_text_size(texto_extraido)

        if not texto_extraido.strip():
            raise HTTPException(
                status_code=400,
                detail="El documento esta vacio o no se pudo extraer el texto.",
            )

        chunks = index_document(
            path_comunidad_id,
            filename,
            texto_extraido,
            uploaded_by=str(current_user["id"]),
            uploaded_by_email=current_user.get("email"),
            source_filename=filename,
        )
        return {
            "message": f"Documento '{filename}' indexado con exito",
            "chunks": chunks,
            "uploaded_by": str(current_user["id"]),
        }

    raise HTTPException(
        status_code=400,
        detail="Content-Type no soportado. Usa JSON o Form-Data.",
    )


@router.delete("/{comunidad_id}/documents")
async def delete_document_by_title(
    comunidad_id: str,
    document_title: str = Query(..., min_length=1),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    path_comunidad_id = str(comunidad_id).strip()
    verify_association_admin_or_president(path_comunidad_id, current_user["id"], supabase)

    result = delete_document(path_comunidad_id, document_title)
    if result["deleted_chunks"] == 0:
        raise HTTPException(status_code=404, detail="Document not found in this community")

    return {
        "message": f"Documento '{result['document_title']}' eliminado con exito",
        **result,
    }
